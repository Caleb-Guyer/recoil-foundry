export function endingCopy(shutdown: boolean, overtime: boolean) {
  if (shutdown)
    return {
      title: 'Shift complete.',
      note: 'For the first time, the factory has nothing left to ask.',
    };
  if (overtime)
    return {
      title: 'Overtime complete.',
      note: 'Two shifts. One gun. You have given this place enough.',
    };
  return {
    title: 'Clean escape.',
    note: 'The lift opens to daylight. Your shift ends here.',
  };
}
