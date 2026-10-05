import { describe, expect, it } from "vitest";

import {
  aiRequestSchema,
  emailSchema,
  formDataToObject,
  inviteSchema,
  loginSchema,
  passwordSchema,
  projectSchema,
  resetPasswordSchema,
  signupSchema,
  taskFilterSchema,
  taskSchema,
  toFieldErrors,
} from "@/lib/validation";

describe("emailSchema", () => {
  it("normalises case and whitespace", () => {
    expect(emailSchema.parse("  Alex@Example.COM ")).toBe("alex@example.com");
  });

  it("rejects malformed addresses", () => {
    for (const value of ["", "nope", "a@b", "a b@c.com"]) {
      expect(emailSchema.safeParse(value).success).toBe(false);
    }
  });
});

describe("passwordSchema", () => {
  it("requires length, a letter and a number", () => {
    expect(passwordSchema.safeParse("short1").success).toBe(false);
    expect(passwordSchema.safeParse("alllettersonly").success).toBe(false);
    expect(passwordSchema.safeParse("1234567890").success).toBe(false);
    expect(passwordSchema.safeParse("Demo1234!").success).toBe(true);
  });
});

describe("signupSchema", () => {
  it("accepts a valid payload and trims the name", () => {
    const parsed = signupSchema.parse({
      name: "  Alex Morgan  ",
      email: "ALEX@example.com",
      password: "Demo1234!",
      workspaceName: "",
    });
    expect(parsed.name).toBe("Alex Morgan");
    expect(parsed.email).toBe("alex@example.com");
  });

  it("reports the field that failed", () => {
    const result = signupSchema.safeParse({ name: "A", email: "bad", password: "x" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = toFieldErrors(result.error);
      expect(Object.keys(errors)).toEqual(expect.arrayContaining(["name", "email", "password"]));
    }
  });
});

describe("loginSchema", () => {
  it("does not enforce password complexity on login", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "x" }).success).toBe(true);
  });
});

describe("resetPasswordSchema", () => {
  it("requires matching passwords", () => {
    const result = resetPasswordSchema.safeParse({
      token: "abcdefghijkl",
      password: "Demo1234!",
      confirmPassword: "Demo1234?",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(toFieldErrors(result.error).confirmPassword).toContain("Passwords do not match");
    }
  });
});

describe("projectSchema", () => {
  it("applies defaults", () => {
    const parsed = projectSchema.parse({ name: "Website redesign" });
    expect(parsed.status).toBe("ACTIVE");
    expect(parsed.color).toBe("#6366f1");
    expect(parsed.memberIds).toEqual([]);
    expect(parsed.deadline).toBeNull();
  });

  it("parses a date string into a Date at midday UTC", () => {
    const parsed = projectSchema.parse({ name: "Launch", deadline: "2026-11-30" });
    expect(parsed.deadline).toBeInstanceOf(Date);
    expect(parsed.deadline?.toISOString()).toBe("2026-11-30T12:00:00.000Z");
  });

  it("rejects an invalid colour and short names", () => {
    expect(projectSchema.safeParse({ name: "X" }).success).toBe(false);
    expect(projectSchema.safeParse({ name: "Valid", color: "blue" }).success).toBe(false);
  });
});

describe("taskSchema", () => {
  it("defaults priority and status", () => {
    const parsed = taskSchema.parse({ title: "Write the spec", projectId: "prj_1" });
    expect(parsed.priority).toBe("MEDIUM");
    expect(parsed.status).toBe("TODO");
    expect(parsed.assigneeId).toBeNull();
  });

  it("rejects unknown enum values", () => {
    expect(
      taskSchema.safeParse({ title: "Task", projectId: "prj_1", priority: "SUPER" }).success,
    ).toBe(false);
    expect(
      taskSchema.safeParse({ title: "Task", projectId: "prj_1", status: "BLOCKED" }).success,
    ).toBe(false);
  });

  it("treats an empty assignee string as unassigned", () => {
    const parsed = taskSchema.parse({ title: "Task", projectId: "prj_1", assigneeId: "" });
    expect(parsed.assigneeId).toBeNull();
  });
});

describe("taskFilterSchema", () => {
  it("coerces page numbers and defaults filters", () => {
    const parsed = taskFilterSchema.parse({ page: "3" });
    expect(parsed.page).toBe(3);
    expect(parsed.projectId).toBe("all");
    expect(parsed.sort).toBe("dueDate");
    expect(parsed.dir).toBe("asc");
  });

  it("rejects invalid sort fields", () => {
    expect(taskFilterSchema.safeParse({ sort: "hacked" }).success).toBe(false);
  });
});

describe("inviteSchema", () => {
  it("only allows workspace-safe roles", () => {
    expect(inviteSchema.parse({ email: "a@b.com", role: "ADMIN" }).role).toBe("ADMIN");
    expect(inviteSchema.safeParse({ email: "a@b.com", role: "OWNER" }).success).toBe(false);
    expect(inviteSchema.safeParse({ email: "a@b.com", role: "SUPERADMIN" }).success).toBe(false);
  });
});

describe("aiRequestSchema", () => {
  it("only accepts known analysis kinds", () => {
    expect(aiRequestSchema.safeParse({ projectId: "prj_1", kind: "summary" }).success).toBe(true);
    expect(aiRequestSchema.safeParse({ projectId: "prj_1", kind: "delete_everything" }).success).toBe(
      false,
    );
  });
});

describe("formDataToObject", () => {
  it("collects repeated keys into arrays", () => {
    const formData = new FormData();
    formData.append("name", "Alex");
    formData.append("memberIds", "usr_1");
    formData.append("memberIds", "usr_2");

    expect(formDataToObject(formData)).toEqual({
      name: "Alex",
      memberIds: ["usr_1", "usr_2"],
    });
  });
});
