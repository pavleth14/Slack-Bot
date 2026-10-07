function withInitialValue(element, value) {
  if (value == null || value === '') {
    return element;
  }
  return { ...element, initial_value: String(value) };
}

function withInitialDate(element, isoDate) {
  if (!isoDate) return element;
  return { ...element, initial_date: isoDate };
}

function withInitialTime(element, time24) {
  if (!time24) return element;
  return { ...element, initial_time: time24 };
}

function withInitialStaticSelect(element, value, options) {
  if (!value) return element;
  const match = options.find((o) => o.value === value);
  if (!match) return element;
  return {
    ...element,
    initial_option: {
      value: match.value,
      text: match.text,
    },
  };
}

function withInitialRadio(element, value, options) {
  if (!value) return element;
  const match = options.find((o) => o.value === value);
  if (!match) return element;
  return { ...element, initial_option: match };
}

function withInitialCheckboxes(element, selectedValues, options) {
  const selected = new Set(selectedValues || []);
  const initial = options.filter((o) => selected.has(o.value));
  if (!initial.length) return element;
  return {
    ...element,
    initial_options: initial.map((o) => ({
      value: o.value,
      text: o.text,
    })),
  };
}

module.exports = {
  withInitialValue,
  withInitialDate,
  withInitialTime,
  withInitialStaticSelect,
  withInitialRadio,
  withInitialCheckboxes,
};
