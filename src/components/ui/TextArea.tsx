"use client";

import {
  forwardRef,
  useId,
  useState,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

/** Counts UTF-16 code units, matching the browser's native maxLength behavior. */
export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  function TextArea(
    {
      value,
      defaultValue,
      maxLength = 500,
      onChange,
      className,
      "aria-describedby": describedBy,
      ...props
    },
    ref,
  ) {
    const counterId = useId();
    const [internalValue, setInternalValue] = useState(
      String(defaultValue ?? ""),
    );
    const count = String(value ?? internalValue).length;
    const limited = maxLength >= 0;
    const color =
      limited && count >= maxLength
        ? "text-red-600"
        : limited && count >= maxLength * 0.9
          ? "text-amber-600"
          : "text-slate-500";

    return (
      <div className="space-y-1">
        <textarea
          {...props}
          ref={ref}
          value={value}
          defaultValue={defaultValue}
          maxLength={maxLength}
          aria-describedby={
            [describedBy, limited ? counterId : undefined]
              .filter(Boolean)
              .join(" ") || undefined
          }
          className={cn(
            "w-full rounded-md border border-slate-200 px-3 py-2 text-sm",
            className,
          )}
          onChange={(event) => {
            if (limited && event.currentTarget.value.length > maxLength) {
              event.currentTarget.value = event.currentTarget.value.slice(
                0,
                maxLength,
              );
            }
            setInternalValue(event.currentTarget.value);
            onChange?.(event);
          }}
        />
        {limited && (
          <p
            id={counterId}
            className={cn("text-right text-xs tabular-nums", color)}
          >
            {count} / {maxLength} characters
          </p>
        )}
      </div>
    );
  },
);

export default TextArea;
