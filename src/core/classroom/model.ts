/**
 * Phase 1b data model only (no UI yet): teacher presentation mode and anonymous classes.
 * Students are identified solely by a generated code; no names, emails, or birthdates of minors.
 */
import type { Rng } from '../random'

/** e.g. "KALE-4521". Word list avoids letters that look alike on smart boards. */
export type ClassCode = string
export type StudentCode = string

const WORDS = ['KALE', 'VEZIR', 'FIL', 'PIYON', 'SAH', 'AT', 'ROK', 'MAT'] as const
const CODE_RE = /^[A-Z]{2,5}-\d{4}$/

export function generateCode(rng: Rng): ClassCode {
  const word = WORDS[Math.floor(rng() * WORDS.length)]
  const digits = String(Math.floor(rng() * 10000)).padStart(4, '0')
  return `${word}-${digits}`
}

export function isValidCode(code: string): boolean {
  return CODE_RE.test(code)
}

export interface Classroom {
  code: ClassCode
  /** Supabase auth user id of the teacher (an adult account). */
  teacherId: string
  /** Free label chosen by the teacher, e.g. "5-B". Must not contain student names. */
  label: string
  createdAt: number
}

export interface StudentSeat {
  code: StudentCode
  classCode: ClassCode
  /** Optional emoji/avatar picked by the student; never a name. */
  avatar?: string
  progressId: string
}

/** Annotations a teacher draws on a shared board (touch-friendly, ETAP/Pardus smart boards). */
export type BoardAnnotation =
  | { kind: 'arrow'; from: string; to: string; color: 'green' | 'red' | 'blue' | 'yellow' }
  | { kind: 'highlight'; square: string; color: 'green' | 'red' | 'blue' | 'yellow' }

export interface PresentationSlide {
  fen: string
  annotations: BoardAnnotation[]
  /** i18n key or teacher-entered note; rendered as-is in teacher's language. */
  note?: string
}

export interface PresentationDeck {
  id: string
  teacherId: string
  titleKey?: string
  title?: string
  slides: PresentationSlide[]
}
