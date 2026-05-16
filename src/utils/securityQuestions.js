/**
 * Predefined security questions
 * Users pick ONE during registration.
 * The answer is hashed with bcrypt before storage.
 */

const SECURITY_QUESTIONS = [
  { id: 1, question: "What is your mother's maiden name?" },
  { id: 2, question: "What was the name of your first pet?" },
  { id: 3, question: "What is the name of the town where you were born?" },
  { id: 4, question: "What was the name of your primary school?" },
  { id: 5, question: "What is your oldest sibling's middle name?" },
  { id: 6, question: "What was the make of your first car?" },
  { id: 7, question: "What is your maternal grandmother's first name?" },
  { id: 8, question: "What was the street you grew up on?" },
  { id: 9, question: "What was your childhood nickname?" },
  { id: 10, question: "What is the name of your favourite childhood friend?" },
];

const getQuestionById = (id) =>
  SECURITY_QUESTIONS.find((q) => q.id === parseInt(id)) || null;

module.exports = { SECURITY_QUESTIONS, getQuestionById };