import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().min(2, "Name is too short").max(100),
  email: z.email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["USER", "AGENT"]).default("USER"),
});

export const loginSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const ticketCreateSchema = z.object({
  title: z.string().min(5, "Title is too short").max(200),
  description: z.string().min(10, "Please add more detail").max(5000),
});

export const commentCreateSchema = z.object({
  ticketId: z.string().min(1),
  body: z.string().min(1, "Comment cannot be empty").max(5000),
  isInternal: z.boolean().default(false),
});

export const ratingSchema = z.object({
  ticketId: z.string().min(1),
  score: z.number().int().min(1).max(5),
  feedback: z.string().max(1000).optional(),
});
