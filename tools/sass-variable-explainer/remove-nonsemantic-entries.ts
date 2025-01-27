export const isRealContent = (v: any) => {
  if (!v?.type) {
    return true;
  }
  if (["space", "comment_singleline", "comment_multiline"].includes(v.type)) {
    return false;
  }
  return true;
}

export const isNotPunctuation = (v: any) => {
  if (!v?.type) {
    return true;
  }
  if (v.type === "punctuation") {
    return false;
  }
  return true
}
