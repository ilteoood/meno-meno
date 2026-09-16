import { runDoctor, doctorToMarkdown } from '../doctor.ts';

export interface SkillDoctorInput {
  readonly operatore?: string;
  readonly live?: boolean;
}

export async function runSkillDoctor(input: SkillDoctorInput = {}): Promise<string> {
  const report = await runDoctor({ operatore: input.operatore, live: input.live });
  return doctorToMarkdown(report);
}
