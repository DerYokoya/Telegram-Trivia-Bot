// validation.ts
export interface ValidationResult {
  valid: boolean;
  error?: string;
  normalized: string; // Make it required, not optional
}

export function validateTopic(topic: string): ValidationResult {
  const trimmed = topic.trim();
  const normalized = trimmed.replace(/\s+/g, ' ').trim();
  
  if (trimmed.length < 2) {
    return { valid: false, error: "Topic must be at least 2 characters", normalized };
  }
  if (trimmed.length > 120) {
    return { valid: false, error: "Topic must be less than 120 characters", normalized };
  }
  
  // Reject excessive unicode/emoji spam
  const hasExcessiveEmoji = (trimmed.match(/[\u{1F600}-\u{1F64F}]/gu) || []).length > 5;
  if (hasExcessiveEmoji) {
    return { valid: false, error: "Please use fewer emojis in topic", normalized };
  }
  
  // Reject control characters
  if (/[\x00-\x1F\x7F-\x9F]/.test(trimmed)) {
    return { valid: false, error: "Topic contains invalid characters", normalized };
  }
  
  return { valid: true, normalized };
}

export function validateNickname(nickname: string): ValidationResult {
  const trimmed = nickname.trim();
  const normalized = trimmed.normalize("NFKC");
  
  if (trimmed.length < 1 || trimmed.length > 24) {
    return { valid: false, error: "Nickname must be 1-24 characters", normalized };
  }
  
  // Reject offensive patterns (customize as needed)
  const offensivePatterns = /(fuck|shit|bitch|asshole)/i;
  if (offensivePatterns.test(trimmed)) {
    return { valid: false, error: "Please choose a different nickname", normalized };
  }
  
  return { valid: true, normalized };
}