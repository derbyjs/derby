module.exports = {
  onStringInsert: onStringInsert
, onStringRemove: onStringRemove
, onTextInput: onTextInput
};

function onStringInsert(el, previous, index, text) {
  function transformCursor(cursor) {
    return (index < cursor) ? cursor + text.length : cursor;
  }
  var newText = previous.slice(0, index) + text + previous.slice(index);
  replaceText(el, newText, transformCursor);
}

function onStringRemove(el, previous, index, howMany) {
  function transformCursor(cursor) {
    return (index < cursor) ? cursor - Math.min(howMany, cursor - index) : cursor;
  }
  var newText = previous.slice(0, index) + previous.slice(index + howMany);
  replaceText(el, newText, transformCursor);
}

function replaceText(el, newText, transformCursor) {
  var selectionStart = transformCursor(el.selectionStart);
  var selectionEnd = transformCursor(el.selectionEnd);

  var scrollTop = el.scrollTop;
  el.value = newText;
  if (el.scrollTop !== scrollTop) {
    el.scrollTop = scrollTop;
  }
  if (document.activeElement === el) {
    el.selectionStart = selectionStart;
    el.selectionEnd = selectionEnd;
  }
}

function onTextInput(model, path, value) {
  var previous = model.get(path) || '';
  if (previous === value) return;
  var start = 0;
  while (previous.charAt(start) == value.charAt(start)) {
    start++;
  }
  var end = 0;
  while (
    previous.charAt(previous.length - 1 - end) === value.charAt(value.length - 1 - end) &&
    end + start < previous.length &&
    end + start < value.length
  ) {
    end++;
  }

  if (previous.length !== start + end) {
    var howMany = previous.length - start - end;
    model.stringRemove(path, start, howMany);
  }
  if (value.length !== start + end) {
    var inserted = value.slice(start, value.length - end);
    model.stringInsert(path, start, inserted);
  }
}
