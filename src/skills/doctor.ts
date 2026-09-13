import { runDoctor, doctorToMarkdown } from '../doctor.ts';

export interface SkillDoctorInput {
  readonly operatore?: string;
}

export async function runSkillDoctor(input: SkillDoctorInput = {}): Promise<string> {
  const report = await runDoctor({ operatore: input.operatore });
  return doctorToMarkdown(report);
}