export type PasswordStrength = {
  score: 0 | 1 | 2 | 3 | 4;
  label: "Very weak" | "Weak" | "Fair" | "Strong" | "Very strong";
  problems: string[];
};

/**
 * Lightweight, dependency-free password strength meter.
 *
 * Lives in its own module (no Node imports) so the signup form can use it in
 * the browser without pulling in node:crypto.
 */
export function passwordStrength(password: string): PasswordStrength {
  const problems: string[] = [];
  let score = 0;

  if (password.length >= 8) score++;
  else problems.push("Use at least 8 characters");

  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  else problems.push("Mix upper and lower case letters");

  if (/\d/.test(password)) score++;
  else problems.push("Include a number");

  if (/[^A-Za-z0-9]/.test(password)) score++;
  else problems.push("Add a symbol for extra strength");

  const labels: PasswordStrength["label"][] = [
    "Very weak",
    "Weak",
    "Fair",
    "Strong",
    "Very strong",
  ];

  return { score: score as PasswordStrength["score"], label: labels[score], problems };
}
