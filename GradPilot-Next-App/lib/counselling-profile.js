const PLACEHOLDER_VALUES = new Set([
  '',
  'n/a',
  'na',
  'not available',
  'not provided',
  'not specified',
  'not sure',
  'other',
  'unknown',
  'pending',
  'not started',
  'below 50%',
  'below ₹10 lakhs',
  '6+ months',
]);

export const COUNSELLING_FIELDS = [
  {
    key: 'studentName',
    label: 'Name',
    placeholder: 'Full name',
    inputType: 'text',
  },
  {
    key: 'phoneNumber',
    label: 'Phone Number',
    placeholder: '+91 98765 43210',
    inputType: 'tel',
  },
  {
    key: 'contactEmail',
    label: 'Email',
    placeholder: 'student@example.com',
    inputType: 'email',
  },
  {
    key: 'currentLocation',
    label: 'Location',
    placeholder: 'City, Country',
    inputType: 'text',
  },
  {
    key: 'educationLevel',
    label: 'Education Level',
    placeholder: "12th / Bachelor's / Master's",
    inputType: 'text',
  },
  {
    key: 'fieldOfStudy',
    label: 'Field of Study',
    placeholder: 'Computer Science, Business, Law...',
    inputType: 'text',
  },
  {
    key: 'institution',
    label: 'Institution',
    placeholder: 'Current or previous institution',
    inputType: 'text',
  },
  {
    key: 'gpaPercentage',
    label: 'GPA / Percentage',
    placeholder: '8.1 CGPA / 78%',
    inputType: 'text',
  },
  {
    key: 'targetCountries',
    label: 'Target Country',
    placeholder: 'UK, Ireland',
    inputType: 'text',
    isArray: true,
  },
  {
    key: 'courseInterest',
    label: 'Course Interest',
    placeholder: 'MSc Data Science',
    inputType: 'text',
  },
  {
    key: 'englishTestStatus',
    label: 'IELTS / PTE Status',
    placeholder: 'IELTS preparing / PTE score 68',
    inputType: 'text',
  },
  {
    key: 'budgetRange',
    label: 'Budget Range',
    placeholder: '20-25 lakhs',
    inputType: 'text',
  },
  {
    key: 'applicationTimeline',
    label: 'Application Timeline',
    placeholder: 'Applying in the next 3 months',
    inputType: 'text',
  },
];

export function normalizeStringValue(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

export function normalizeArrayValue(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeStringValue(String(item)))
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(/[,/;|]/)
      .map((item) => normalizeStringValue(item))
      .filter(Boolean);
  }

  return [];
}

export function normalizePhoneNumber(value) {
  const trimmed = normalizeStringValue(value);
  if (!trimmed) return '';

  const digits = trimmed.replace(/[^\d+]/g, '');
  if (digits.replace(/\D/g, '').length < 7) return '';
  return digits;
}

export function normalizeEmail(value) {
  const trimmed = normalizeStringValue(value).toLowerCase();
  if (!trimmed) return '';

  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  return isValid ? trimmed : '';
}

export function buildEnglishTestStatus(profile = {}) {
  const explicit = normalizeStringValue(profile.englishTestStatus);
  if (explicit) return explicit;

  const status = normalizeStringValue(profile.testStatus);
  const score = normalizeStringValue(profile.testScore);

  if (status && score && score.toLowerCase() !== 'n/a') {
    return `${status} (${score})`;
  }

  if (status) return status;
  if (score && score.toLowerCase() !== 'n/a') return `Score ${score}`;

  return '';
}

export function getCounsellingFieldValue(profile = {}, key) {
  if (key === 'englishTestStatus') {
    return buildEnglishTestStatus(profile);
  }

  if (key === 'targetCountries') {
    return normalizeArrayValue(profile.targetCountries);
  }

  return normalizeStringValue(profile?.[key]);
}

export function isMeaningfulCounsellingValue(value) {
  if (Array.isArray(value)) {
    return value.some((item) => isMeaningfulCounsellingValue(item));
  }

  if (typeof value === 'string') {
    const normalized = normalizeStringValue(value);
    if (!normalized) return false;
    return !PLACEHOLDER_VALUES.has(normalized.toLowerCase());
  }

  return value !== null && value !== undefined;
}

export function buildCounsellingProgress(profile = {}) {
  const filledFields = COUNSELLING_FIELDS.filter((field) =>
    isMeaningfulCounsellingValue(getCounsellingFieldValue(profile, field.key))
  );

  const missingFields = COUNSELLING_FIELDS.filter(
    (field) => !filledFields.some((filledField) => filledField.key === field.key)
  );

  return {
    totalCount: COUNSELLING_FIELDS.length,
    filledCount: filledFields.length,
    isComplete: missingFields.length === 0,
    filledFields: filledFields.map((field) => field.key),
    missingFields: missingFields.map((field) => field.key),
    missingLabels: missingFields.map((field) => field.label),
  };
}

export function buildCounsellingFactMap(profile = {}) {
  const facts = {};

  for (const field of COUNSELLING_FIELDS) {
    const value = getCounsellingFieldValue(profile, field.key);
    if (!isMeaningfulCounsellingValue(value)) continue;

    facts[field.key] = Array.isArray(value) ? value.join(', ') : value;
  }

  return facts;
}

export function normalizeCounsellingProfilePatch(extracted = {}) {
  const patch = {};

  for (const field of COUNSELLING_FIELDS) {
    const rawValue = extracted?.[field.key];
    if (rawValue === null || rawValue === undefined) continue;

    if (field.key === 'targetCountries') {
      const values = normalizeArrayValue(rawValue);
      if (values.length > 0) patch.targetCountries = values;
      continue;
    }

    if (field.key === 'phoneNumber') {
      const value = normalizePhoneNumber(rawValue);
      if (value) patch.phoneNumber = value;
      continue;
    }

    if (field.key === 'contactEmail') {
      const value = normalizeEmail(rawValue);
      if (value) patch.contactEmail = value;
      continue;
    }

    const value = normalizeStringValue(String(rawValue));
    if (value) patch[field.key] = value;
  }

  return patch;
}

function calculateValueSpecificity(value) {
  if (!isMeaningfulCounsellingValue(value)) return 0;

  if (Array.isArray(value)) {
    return value.reduce((score, item) => score + calculateValueSpecificity(item), value.length * 10);
  }

  const normalized = normalizeStringValue(String(value));
  const digitBonus = /\d/.test(normalized) ? 12 : 0;
  const emailBonus = normalized.includes('@') ? 20 : 0;
  return normalized.length + digitBonus + emailBonus;
}

function mergeArrayValues(currentValue, nextValue) {
  const current = normalizeArrayValue(currentValue);
  const next = normalizeArrayValue(nextValue);
  const merged = [...current];

  for (const item of next) {
    if (!merged.some((existingItem) => existingItem.toLowerCase() === item.toLowerCase())) {
      merged.push(item);
    }
  }

  return merged;
}

export function mergeCounsellingProfile(existingProfile = {}, nextPatch = {}) {
  const mergedProfile = { ...existingProfile };
  const changedFields = [];
  const newFields = [];

  for (const field of COUNSELLING_FIELDS) {
    const key = field.key;
    if (!(key in nextPatch)) continue;

    const currentValue = getCounsellingFieldValue(existingProfile, key);
    const nextValue = field.isArray
      ? normalizeArrayValue(nextPatch[key])
      : getCounsellingFieldValue(nextPatch, key);

    if (!isMeaningfulCounsellingValue(nextValue)) continue;

    if (field.isArray) {
      const mergedArray = mergeArrayValues(currentValue, nextValue);
      const currentArray = normalizeArrayValue(currentValue);

      if (mergedArray.length !== currentArray.length) {
        mergedProfile[key] = mergedArray;
        changedFields.push(key);
        if (!isMeaningfulCounsellingValue(currentArray)) newFields.push(key);
      }
      continue;
    }

    const hasCurrent = isMeaningfulCounsellingValue(currentValue);
    const hasNext = isMeaningfulCounsellingValue(nextValue);
    if (!hasNext) continue;

    const currentNormalized = normalizeStringValue(String(currentValue || ''));
    const nextNormalized = normalizeStringValue(String(nextValue || ''));
    if (currentNormalized.toLowerCase() === nextNormalized.toLowerCase()) continue;

    const shouldReplace = !hasCurrent
      || nextNormalized.toLowerCase().includes(currentNormalized.toLowerCase())
      || calculateValueSpecificity(nextNormalized) > calculateValueSpecificity(currentNormalized) + 4;

    if (!shouldReplace) continue;

    mergedProfile[key] = nextNormalized;
    changedFields.push(key);
    if (!hasCurrent) newFields.push(key);
  }

  return {
    mergedProfile,
    changedFields,
    newFields,
  };
}

export function buildCounsellingPatch(key, rawValue) {
  if (key === 'targetCountries') {
    return { targetCountries: normalizeArrayValue(rawValue) };
  }

  if (key === 'phoneNumber') {
    return { phoneNumber: normalizePhoneNumber(rawValue) };
  }

  if (key === 'contactEmail') {
    return { contactEmail: normalizeEmail(rawValue) };
  }

  if (key === 'englishTestStatus') {
    return { englishTestStatus: normalizeStringValue(rawValue) };
  }

  return { [key]: normalizeStringValue(rawValue) };
}

export function buildCounsellingSnapshot(profile = {}) {
  const snapshot = {};

  for (const field of COUNSELLING_FIELDS) {
    snapshot[field.key] = getCounsellingFieldValue(profile, field.key);
  }

  return snapshot;
}