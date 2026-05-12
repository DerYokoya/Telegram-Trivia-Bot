export function validateTopic(topic: string): {
  valid: boolean;
  error?: string;
} {
  const trimmed = topic.trim();

  if (trimmed.length < 2) {
    return { valid: false, error: "Topic must be at least 2 characters" };
  }
  if (trimmed.length > 120) {
    return { valid: false, error: "Topic must be less than 120 characters" };
  }

  const hasExcessiveEmoji =
    (trimmed.match(/[\u{1F600}-\u{1F64F}]/gu) || []).length > 5;
  if (hasExcessiveEmoji) {
    return { valid: false, error: "Please use fewer emojis in topic" };
  }

  if (/[\x00-\x1F\x7F-\x9F]/.test(trimmed)) {
    return { valid: false, error: "Topic contains invalid characters" };
  }

  return { valid: true };
}

export function validateNickname(nickname: string): {
  valid: boolean;
  error?: string;
  normalized?: string;
} {
  const trimmed = nickname.trim();

  if (trimmed.length < 1 || trimmed.length > 24) {
    return { valid: false, error: "Nickname must be 1-24 characters" };
  }

  const offensivePatterns = /(fuck|shit|bitch|asshole)/i;
  if (offensivePatterns.test(trimmed)) {
    return { valid: false, error: "Please choose a different nickname" };
  }

  const normalized = trimmed.normalize("NFKC");
  if (normalized !== trimmed) {
    return { valid: true, normalized };
  }

  return { valid: true, normalized: trimmed };
}
