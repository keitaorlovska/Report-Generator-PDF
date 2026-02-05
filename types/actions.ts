export type Motion = {
  text: string
  reasoning: string
  category?: string
  link?: string
}


export interface ActionResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

export type GenerateMotionsResponse = ActionResponse<{
  motions: Motion[]
  context?: string
}>

