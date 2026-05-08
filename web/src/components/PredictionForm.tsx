import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { formValuesToFeatures, predictRisk } from "../services/api";
import type {
  PredictResponseBody,
  PredictionFormValues,
  PredictionHistoryEntry,
} from "../types/prediction";

const finiteNonNeg = (label: string) =>
  z
    .number({ required_error: `${label} is required`, invalid_type_error: `${label} must be a number` })
    .refine((n) => Number.isFinite(n), `${label} must be a valid number`)
    .refine((n) => n >= 0, `${label} must be zero or greater`);

const schema = z.object({
  age: z
    .number({ required_error: "Age is required", invalid_type_error: "Age must be a number" })
    .refine((n) => Number.isFinite(n), "Age must be a valid number")
    .refine((n) => n > 0, "Age must be greater than zero"),
  sex: z
    .string()
    .refine((s) => s === "M" || s === "F", { message: "Please select sex (M or F)" }),
  plasma_CA19_9: finiteNonNeg("Plasma CA19-9"),
  creatinine: finiteNonNeg("Creatinine"),
  LYVE1: finiteNonNeg("LYVE1"),
  REG1B: finiteNonNeg("REG1B"),
  TFF1: finiteNonNeg("TFF1"),
  model: z.union([z.literal(""), z.enum(["lr", "rf", "xgb", "ann"])]).default(""),
});

type FormSchema = z.infer<typeof schema>;

const fieldWrap =
  "flex flex-col gap-1.5 rounded-xl border border-slate-200/90 bg-slate-50/50 px-4 py-3 transition focus-within:border-clinical-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-clinical-500/20";

/**
 * Card-based clinical input form with Zod + RHF validation and API submit.
 */
export type PredictionSubmitSuccess = {
  result: PredictResponseBody;
  features: PredictionHistoryEntry["features"];
};

export function PredictionForm({
  onSuccess,
}: {
  onSuccess: (payload: PredictionSubmitSuccess) => void;
}) {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormSchema>({
    resolver: zodResolver(schema),
    defaultValues: {
      model: "",
    },
  });

  const onSubmit = async (data: FormSchema) => {
    setSubmitError(null);
    const modelOverride: "" | "lr" | "rf" | "xgb" | "ann" = data.model ?? "";
    const values: PredictionFormValues = {
      age: data.age,
      sex: data.sex as "M" | "F",
      plasma_CA19_9: data.plasma_CA19_9,
      creatinine: data.creatinine,
      LYVE1: data.LYVE1,
      REG1B: data.REG1B,
      TFF1: data.TFF1,
      ...(modelOverride !== "" ? { model: modelOverride } : {}),
    };
    const features = formValuesToFeatures(values);
    const body = {
      features,
      model: modelOverride === "" ? null : modelOverride,
    };
    try {
      const res = await predictRisk(body);
      const storedFeatures: PredictionHistoryEntry["features"] = {
        age: values.age,
        sex: values.sex,
        plasma_CA19_9: values.plasma_CA19_9,
        creatinine: values.creatinine,
        LYVE1: values.LYVE1,
        REG1B: values.REG1B,
        TFF1: values.TFF1,
      };
      onSuccess({ result: res, features: storedFeatures });
      reset();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Something went wrong.");
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card sm:p-8"
      noValidate
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div className={fieldWrap}>
          <label htmlFor="age" className="text-sm font-medium text-slate-700">
            Age (years)
          </label>
          <input
            id="age"
            type="number"
            inputMode="decimal"
            placeholder="e.g. 64"
            className="w-full rounded-lg border-0 bg-transparent text-slate-900 placeholder:text-slate-400 focus:ring-0"
            aria-invalid={errors.age ? "true" : "false"}
            aria-describedby={errors.age ? "age-err" : undefined}
            {...register("age", { valueAsNumber: true })}
          />
          {errors.age && (
            <p id="age-err" className="text-sm text-rose-600" role="alert">
              {errors.age.message}
            </p>
          )}
        </div>

        <div className={fieldWrap}>
          <label htmlFor="sex" className="text-sm font-medium text-slate-700">
            Sex
          </label>
          <select
            id="sex"
            className="w-full rounded-lg border-0 bg-transparent text-slate-900 focus:ring-0"
            aria-invalid={errors.sex ? "true" : "false"}
            aria-describedby={errors.sex ? "sex-err" : undefined}
            {...register("sex")}
          >
            <option value="">Select…</option>
            <option value="M">Male (M)</option>
            <option value="F">Female (F)</option>
          </select>
          {errors.sex && (
            <p id="sex-err" className="text-sm text-rose-600" role="alert">
              {errors.sex.message}
            </p>
          )}
        </div>

        <div className={fieldWrap}>
          <label htmlFor="plasma_CA19_9" className="text-sm font-medium text-slate-700">
            Plasma CA19-9
          </label>
          <input
            id="plasma_CA19_9"
            type="number"
            inputMode="decimal"
            step="any"
            placeholder="U/mL"
            className="w-full rounded-lg border-0 bg-transparent text-slate-900 placeholder:text-slate-400 focus:ring-0"
            aria-invalid={errors.plasma_CA19_9 ? "true" : "false"}
            {...register("plasma_CA19_9", { valueAsNumber: true })}
          />
          {errors.plasma_CA19_9 && (
            <p className="text-sm text-rose-600" role="alert">
              {errors.plasma_CA19_9.message}
            </p>
          )}
        </div>

        <div className={fieldWrap}>
          <label htmlFor="creatinine" className="text-sm font-medium text-slate-700">
            Creatinine
          </label>
          <input
            id="creatinine"
            type="number"
            inputMode="decimal"
            step="any"
            placeholder="mg/dL"
            className="w-full rounded-lg border-0 bg-transparent text-slate-900 placeholder:text-slate-400 focus:ring-0"
            {...register("creatinine", { valueAsNumber: true })}
          />
          {errors.creatinine && (
            <p className="text-sm text-rose-600" role="alert">
              {errors.creatinine.message}
            </p>
          )}
        </div>

        <div className={fieldWrap}>
          <label htmlFor="LYVE1" className="text-sm font-medium text-slate-700">
            LYVE1
          </label>
          <input
            id="LYVE1"
            type="number"
            inputMode="decimal"
            step="any"
            placeholder="Biomarker level"
            className="w-full rounded-lg border-0 bg-transparent text-slate-900 placeholder:text-slate-400 focus:ring-0"
            {...register("LYVE1", { valueAsNumber: true })}
          />
          {errors.LYVE1 && (
            <p className="text-sm text-rose-600" role="alert">
              {errors.LYVE1.message}
            </p>
          )}
        </div>

        <div className={fieldWrap}>
          <label htmlFor="REG1B" className="text-sm font-medium text-slate-700">
            REG1B
          </label>
          <input
            id="REG1B"
            type="number"
            inputMode="decimal"
            step="any"
            placeholder="Biomarker level"
            className="w-full rounded-lg border-0 bg-transparent text-slate-900 placeholder:text-slate-400 focus:ring-0"
            {...register("REG1B", { valueAsNumber: true })}
          />
          {errors.REG1B && (
            <p className="text-sm text-rose-600" role="alert">
              {errors.REG1B.message}
            </p>
          )}
        </div>

        <div className={`${fieldWrap} sm:col-span-2`}>
          <label htmlFor="TFF1" className="text-sm font-medium text-slate-700">
            TFF1
          </label>
          <input
            id="TFF1"
            type="number"
            inputMode="decimal"
            step="any"
            placeholder="Biomarker level"
            className="w-full rounded-lg border-0 bg-transparent text-slate-900 placeholder:text-slate-400 focus:ring-0"
            {...register("TFF1", { valueAsNumber: true })}
          />
          {errors.TFF1 && (
            <p className="text-sm text-rose-600" role="alert">
              {errors.TFF1.message}
            </p>
          )}
        </div>

        <div className={`${fieldWrap} sm:col-span-2`}>
          <label htmlFor="model" className="text-sm font-medium text-slate-700">
            Model (optional)
          </label>
          <select
            id="model"
            className="w-full max-w-md rounded-lg border-0 bg-transparent text-slate-900 focus:ring-0"
            {...register("model")}
          >
            <option value="">Use server default (active model)</option>
            <option value="lr">Logistic Regression</option>
            <option value="rf">Random Forest</option>
            <option value="xgb">XGBoost</option>
            <option value="ann">Artificial Neural Network</option>
          </select>
          <p className="text-xs text-slate-500">
            Matches FastAPI <code className="rounded bg-slate-100 px-1">model</code> field; leave default
            unless you know the model is loaded on the server.
          </p>
        </div>
      </div>

      {submitError && (
        <div
          className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"
          role="alert"
        >
          {submitError}
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex min-h-[44px] min-w-[160px] items-center justify-center rounded-xl bg-gradient-to-r from-clinical-600 to-clinical-700 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:from-clinical-700 hover:to-clinical-800 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-clinical-500 focus-visible:ring-offset-2"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <span
                className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
                aria-hidden
              />
              Analyzing...
            </span>
          ) : (
            "Submit for prediction"
          )}
        </button>
        <p className="text-xs text-slate-500">Typical response time depends on model load and network.</p>
      </div>
    </form>
  );
}
