/** Split strings like "AR - Abdul Rehman" into code and label parts. */
export function splitCodeAndLabel(text?: string | null): { code?: string; label?: string } {
  const trimmed = text?.trim();
  if (!trimmed) return {};

  const separator = " - ";
  const index = trimmed.indexOf(separator);
  if (index > 0) {
    const code = trimmed.slice(0, index).trim();
    const label = trimmed.slice(index + separator.length).trim();
    if (code && label) return { code, label };
  }

  return { label: trimmed };
}
