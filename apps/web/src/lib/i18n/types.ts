import type ruMessages from "@/messages/ru.json";
import enMessages from "@/messages/en.json";

export type Messages = typeof ruMessages;

// Compile-time check that en.json matches ru.json structure exactly
const _enParityCheck: Messages = enMessages;
void _enParityCheck;
