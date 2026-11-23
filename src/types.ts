export type Status = 'PENDING'|'UPLOADED'|'PROCESSING'|'EXTRACTED'|'GENERATING'|'READY'|'FAILED'
export interface StudySet {
  setId: string
  title: string
  course: string
  status: Status
  fileSize: number|null
  pageCount: number|null
  characterCount: number|null
  flashcardCount: number|null
  quizCount: number|null
  generationProvider: string|null
  errorMessage: string|null
  createdAt: string
  updatedAt: string
}
export interface Flashcard { question: string; answer: string; page: number }
export interface Quiz { question: string; options: string[]; correctIndex: number; explanation: string; page: number }
export interface StudyMaterial { summary: string; flashcards: Flashcard[]; quizzes: Quiz[]; metadata?: { isMock?: boolean; provider?: string } }
export interface MaterialResponse { setId: string; title: string; course: string; status: 'READY'; material: StudyMaterial }
export interface UploadUrl { setId: string; uploadUrl: string; method: 'PUT'; headers: Record<string,string>; expiresIn: number }
