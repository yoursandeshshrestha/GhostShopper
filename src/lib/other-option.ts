export function splitOtherOption(
  items: readonly string[],
  value: string
): { selectValue: string; customValue: string; showCustom: boolean } {
  if (!items.includes('Other')) {
    return { selectValue: value, customValue: '', showCustom: false }
  }
  if (!value) {
    return { selectValue: '', customValue: '', showCustom: false }
  }
  if (value !== 'Other' && items.includes(value)) {
    return { selectValue: value, customValue: '', showCustom: false }
  }
  return {
    selectValue: 'Other',
    customValue: value === 'Other' ? '' : value,
    showCustom: true,
  }
}

export function isOtherOptionComplete(value: string) {
  return Boolean(value.trim()) && value.trim() !== 'Other'
}
