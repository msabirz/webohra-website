import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/index';
import { subcategoryFields, listingFieldValues, subcategories } from '@/db/schema';

type SubcategoryField = typeof subcategoryFields.$inferSelect;

/**
 * The half of FR-17 validation that can't live in a static Zod schema
 * (lib/validation.ts's fieldValuesField): whether a given map of
 * fieldKey -> value actually satisfies the specific subcategory's
 * admin-configured fields — required-ness, and that each value's shape
 * matches its field's type. Shared by POST /api/listings and
 * PUT /api/listings/[idOrSlug] so the two can't drift apart on what
 * counts as valid.
 */
export async function validateFieldValues(
  subcategoryId: number,
  raw: Record<string, unknown> | undefined,
): Promise<{ ok: true; values: Array<{ fieldId: number; value: unknown }> } | { ok: false; issues: Record<string, string> }> {
  // Archived fields impose no requirement and are never read from the
  // incoming payload — the seller form doesn't render them at all (see
  // GET /api/categories), so there's nothing for her to have filled in.
  const fields = await db
    .select()
    .from(subcategoryFields)
    .where(and(eq(subcategoryFields.subcategoryId, subcategoryId), eq(subcategoryFields.active, true)))
    .orderBy(asc(subcategoryFields.sortOrder));

  const input = raw ?? {};
  const issues: Record<string, string> = {};
  const values: Array<{ fieldId: number; value: unknown }> = [];

  for (const field of fields) {
    const value = input[field.fieldKey];
    const isEmpty =
      value === undefined ||
      value === null ||
      value === '' ||
      (Array.isArray(value) && value.length === 0);

    if (isEmpty) {
      if (field.required) issues[field.fieldKey] = `${field.label} is required`;
      continue;
    }

    const checked = checkFieldValue(field, value);
    if (!checked.ok) {
      issues[field.fieldKey] = checked.error;
      continue;
    }
    values.push({ fieldId: field.id, value: checked.value });
  }

  if (Object.keys(issues).length > 0) return { ok: false, issues };
  return { ok: true, values };
}

function checkFieldValue(
  field: SubcategoryField,
  value: unknown,
): { ok: true; value: unknown } | { ok: false; error: string } {
  switch (field.fieldType) {
    case 'text':
    case 'textarea':
    case 'image':
      return typeof value === 'string' ? { ok: true, value } : { ok: false, error: `${field.label} must be text` };
    case 'number': {
      const n = typeof value === 'number' ? value : Number(value);
      return Number.isFinite(n) ? { ok: true, value: n } : { ok: false, error: `${field.label} must be a number` };
    }
    case 'boolean':
      return typeof value === 'boolean'
        ? { ok: true, value }
        : { ok: false, error: `${field.label} must be true or false` };
    case 'select': {
      const options = field.options ?? [];
      return typeof value === 'string' && options.includes(value)
        ? { ok: true, value }
        : { ok: false, error: `Choose a valid option for ${field.label}` };
    }
    case 'multi_select': {
      const options = field.options ?? [];
      if (!Array.isArray(value) || !value.every((v) => typeof v === 'string' && options.includes(v))) {
        return { ok: false, error: `Choose valid options for ${field.label}` };
      }
      return { ok: true, value };
    }
    default:
      return { ok: false, error: `Unknown field type for ${field.label}` };
  }
}

/**
 * Replaces the listing's stored value for each *active* field of its
 * subcategory with what was just submitted — simplest correct approach for
 * a form that resubmits the whole active-fields map every save, rather
 * than tracking per-field creates/updates/deletes individually.
 *
 * Deliberately scoped to only the active field ids for this subcategory,
 * not a blanket "delete everything for this listing": the seller form only
 * ever sends values for fields it actually rendered (active ones), so a
 * naive full wipe-and-replace would silently erase any value already
 * recorded against a field an admin has since archived, the very first
 * time she saves any other edit to the listing. Archived fields' rows are
 * left untouched here — they still exist, still display (see
 * getListingFieldValues), and would come back to life automatically if the
 * field is ever restored to active.
 */
export async function saveFieldValues(
  listingId: number,
  subcategoryId: number,
  values: Array<{ fieldId: number; value: unknown }>,
) {
  const activeFields = await db
    .select({ id: subcategoryFields.id })
    .from(subcategoryFields)
    .where(and(eq(subcategoryFields.subcategoryId, subcategoryId), eq(subcategoryFields.active, true)));
  const activeFieldIds = activeFields.map((f) => f.id);

  if (activeFieldIds.length > 0) {
    await db
      .delete(listingFieldValues)
      .where(and(eq(listingFieldValues.listingId, listingId), inArray(listingFieldValues.fieldId, activeFieldIds)));
  }
  if (values.length === 0) return;
  await db.insert(listingFieldValues).values(values.map((v) => ({ listingId, fieldId: v.fieldId, value: v.value })));
}

/**
 * "Self-managed shipping needs an estimate" only ever made sense for
 * physical_product listings — a local_service/remote_service listing has
 * no shipping UI at all, but the seller form still sends a harmless
 * shippingMethod: 'self_managed' default for it regardless, so this used
 * to fire as a blanket rule and silently reject every service listing
 * (see listingCreateSchema's comment in lib/validation.ts). Only the route
 * handlers know the subcategory's real listingType, so the check lives
 * here instead of in the static Zod schema.
 */
export async function checkShippingEstimate(
  subcategoryId: number,
  shippingMethod: 'self_managed' | 'delhivery',
  shippingEstimateText: string | undefined,
): Promise<{ ok: true } | { ok: false; issues: Record<string, string> }> {
  const [subcategory] = await db
    .select({ listingType: subcategories.listingType })
    .from(subcategories)
    .where(eq(subcategories.id, subcategoryId));

  if (subcategory?.listingType === 'physical_product' && shippingMethod === 'self_managed' && !shippingEstimateText) {
    return {
      ok: false,
      issues: { shippingEstimateText: 'Provide a delivery estimate when handling shipping yourself' },
    };
  }
  return { ok: true };
}

/** Resolves a listing's stored values back into { label, fieldKey,
 *  fieldType, value }[] for display — used by the public listing detail
 *  route (PDP/SDP) and anywhere else that needs to show what was entered,
 *  not just what's allowed. */
export async function getListingFieldValues(listingId: number) {
  return db
    .select({
      fieldKey: subcategoryFields.fieldKey,
      label: subcategoryFields.label,
      fieldType: subcategoryFields.fieldType,
      value: listingFieldValues.value,
    })
    .from(listingFieldValues)
    .innerJoin(subcategoryFields, eq(listingFieldValues.fieldId, subcategoryFields.id))
    .where(eq(listingFieldValues.listingId, listingId))
    .orderBy(asc(subcategoryFields.sortOrder));
}
