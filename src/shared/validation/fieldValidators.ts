// Single source of truth for input-field validation.

import { parseOccurredOn } from '../../memories/data/memories'

export type FieldValidator = {
  readonly maxLength?: number
  readonly required: boolean
  /** Returns null if the value is valid, otherwise a short, user-facing error message. */
  readonly validate: (value: string) => string | null
}

export function isValid(validator: FieldValidator, value: string): boolean {
  return validator.validate(value) === null
}

export function allValid(pairs: Array<[FieldValidator, string]>): boolean {
  for (const [v, value] of pairs)
    if (v.validate(value) !== null)
      return false

  return true
}

/**
 * Walks `pairs` in order and returns the first non-null error message,
 * or null if every pair validates.
 */
export function firstError(pairs: Array<[FieldValidator, string]>): string | null {
  for (const [v, value] of pairs) {
    const err = v.validate(value)
    if (err !== null)
      return err
  }
  return null
}

/** Letters from any alphabet plus spaces, hyphens, apostrophes, and periods. */
const NAME_PATTERN = /^[\p{L}\p{M}\s\-'.]+$/u

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** 7-20 digits with optional +, spaces, dashes, parens, dots, and a leading country-code marker. */
const PHONE_PATTERN = /^\+?[\d\s().-]{7,25}$/

export const PERSON_NAME_MAX = 80
export const PLACE_NAME_MAX = 80
export const GROUP_NAME_MAX = 60
export const MEMORY_TITLE_MAX = 120
export const MEMORY_DESCRIPTION_MAX = 2000
export const RELATIONSHIP_MAX = 60
export const EMAIL_MAX = 254
export const PHONE_MAX = 25
export const ADDRESS_MAX = 200
export const EDGE_LABEL_MAX = 60
export const PROFILE_NAME_MAX = 50
export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 256

export const MIN_BIRTHDAY_ISO = '1900-01-01'

function nameLike(opts: {
  label: string
  maxLength: number
  required: boolean
}): FieldValidator {
  const { label, maxLength, required } = opts
  return {
    maxLength,
    required,
    validate: (raw) => {
      const value = raw.trim()
      if (value.length === 0)
        return required ? `${label} is required.` : null

      if (value.length > maxLength)
        return `${label} must be ${maxLength} characters or fewer.`

      if (!NAME_PATTERN.test(value))
        return `${label} can use letters, spaces, hyphens, apostrophes, or periods.`

      return null
    },
  }
}

function freeText(opts: {
  label: string
  maxLength: number
  required: boolean
  /** When true, leading/trailing whitespace counts toward the length. */
  noTrim?: boolean
}): FieldValidator {
  const { label, maxLength, required, noTrim } = opts
  return {
    maxLength,
    required,
    validate: (raw) => {
      const value = noTrim ? raw : raw.trim()
      if (value.length === 0) {
        return required ? `${label} is required.` : null
      }
      if (value.length > maxLength) {
        return `${label} must be ${maxLength} characters or fewer.`
      }
      return null
    },
  }
}

export const personNameValidator: FieldValidator = nameLike({
  label: 'Name',
  maxLength: PERSON_NAME_MAX,
  required: true,
})

export const placeNameValidator: FieldValidator = nameLike({
  label: 'Name',
  maxLength: PLACE_NAME_MAX,
  required: true,
})

export const groupNameValidator: FieldValidator = freeText({
  label: 'Group name',
  maxLength: GROUP_NAME_MAX,
  required: true,
})

export const relationshipValidator: FieldValidator = freeText({
  label: 'Relationship',
  maxLength: RELATIONSHIP_MAX,
  required: false,
})

export const emailValidator: FieldValidator = {
  maxLength: EMAIL_MAX,
  required: false,
  validate: (raw) => {
    const value = raw.trim()
    if (value.length === 0)
      return null

    if (value.length > EMAIL_MAX)
      return `Email must be ${EMAIL_MAX} characters or fewer.`

    if (!EMAIL_PATTERN.test(value))
      return 'Enter a valid email like name@example.com.'

    return null
  },
}

export const phoneValidator: FieldValidator = {
  maxLength: PHONE_MAX,
  required: false,
  validate: (raw) => {
    const value = raw.trim()
    if (value.length === 0)
      return null

    if (!PHONE_PATTERN.test(value))
      return 'Use digits with optional spaces, dashes, dots, or parentheses.'

    const digits = value.replace(/\D/g, '')
    if (digits.length < 7)
      return 'Phone number is too short.'

    if (digits.length > 15)
      return 'Phone number is too long.'

    return null
  },
}

export const addressValidator: FieldValidator = freeText({
  label: 'Address',
  maxLength: ADDRESS_MAX,
  required: false,
})

export const edgeLabelValidator: FieldValidator = freeText({
  label: 'Label',
  maxLength: EDGE_LABEL_MAX,
  required: false,
})

export const memoryTitleValidator: FieldValidator = freeText({
  label: 'Memory name',
  maxLength: MEMORY_TITLE_MAX,
  required: true,
})

export const memoryDescriptionValidator: FieldValidator = freeText({
  label: 'Description',
  maxLength: MEMORY_DESCRIPTION_MAX,
  required: false,
  noTrim: true,
})

/** Returns today as YYYY-MM-DD in local time. */
export function todayISODate(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export const memoryDateValidator: FieldValidator = {
  required: true,
  validate: (raw) => {
    const value = raw.trim()
    if (value.length === 0)
      return 'Choose a date for this memory.'

    if (!parseOccurredOn(value))
      return 'Use a valid calendar date (YYYY-MM-DD).'

    if (value > todayISODate())
      return 'Date cannot be in the future.'

    if (value < MIN_BIRTHDAY_ISO)
      return 'Please enter a date on or after 1900.'

    return null
  },
}

export const profileNameValidator: FieldValidator = {
  maxLength: PROFILE_NAME_MAX,
  required: false,
  validate: (raw) => {
    const value = raw.trim()
    if (value.length === 0)
      return null

    if (value.length > PROFILE_NAME_MAX)
      return `Must be ${PROFILE_NAME_MAX} characters or fewer.`

    if (!NAME_PATTERN.test(value))
      return 'Use letters, spaces, hyphens, or apostrophes only.'

    return null
  },
}

export const birthdayValidator: FieldValidator = {
  required: false,
  validate: (raw) => {
    const value = raw.trim()
    if (value.length === 0) return null
    const parsed = new Date(`${value}T00:00:00`)
    if (Number.isNaN(parsed.getTime()))
      return 'Please enter a valid date.'

    if (value > todayISODate())
      return 'Birthday cannot be in the future.'

    if (value < MIN_BIRTHDAY_ISO)
      return 'Please enter a date on or after 1900.'

    return null
  },
}

export const authEmailValidator: FieldValidator = {
  maxLength: EMAIL_MAX,
  required: true,
  validate: (raw) => {
    const value = raw.trim()
    if (value.length === 0)
      return 'Email is required.'

    if (value.length > EMAIL_MAX)
      return `Email must be ${EMAIL_MAX} characters or fewer.`

    if (!EMAIL_PATTERN.test(value))
      return 'Enter a valid email like name@example.com.'

    return null
  },
}

export const passwordValidator: FieldValidator = {
  maxLength: PASSWORD_MAX,
  required: true,
  validate: (raw) => {
    if (raw.length === 0)
      return 'Password is required.'

    if (raw.length < PASSWORD_MIN)
      return `Password must be at least ${PASSWORD_MIN} characters.`

    if (raw.length > PASSWORD_MAX)
      return `Password must be ${PASSWORD_MAX} characters or fewer.`

    return null
  },
}
