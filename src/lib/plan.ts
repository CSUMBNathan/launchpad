export type BoredomType = "tedious" | "understimulated" | "draining" | "meaningless";

export type EnergyLevel = "low" | "medium" | "high";

export type BudgetLevel = "free" | "small" | "flexible";

export interface PlanWarmup {
  label: string;
  minutes: number;
  indoors_outdoors: "indoors" | "outdoors" | "either";
  backup_options: string[];
}

export interface PlanTinyStartStep {
  steps: string[];
}

export interface PlanSprint {
  minutes: number;
  focus_rule: string;
  break_rule: string;
}

export interface PlanReward {
  label: string;
  duration_minutes: number;
  unlock_condition: string;
}

export interface Plan {
  warmup: PlanWarmup;
  tiny_start_step: PlanTinyStartStep;
  sprint: PlanSprint;
  reward: PlanReward;
}

export interface GeneratePlanRequest {
  assignment_text: string;
  boredom_type: BoredomType;
  time_available_minutes: number;
  energy_level: EnergyLevel;
  can_go_out: boolean;
  budget_level: BudgetLevel;
  notes?: string;
}

