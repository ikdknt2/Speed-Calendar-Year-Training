const fs = require('fs');
const assert = require('assert');
const vm = require('vm');

const html = fs.readFileSync('index.html', 'utf8');
const script = html.slice(html.indexOf('<script>') + '<script>'.length, html.indexOf('</script>'));

function createElement(id) {
  return {
    id,
    textContent: '',
    className: '',
    value: id === 'advancedFilter' ? 'all' : '',
    hidden: false,
    dataset: {},
    classList: { contains: () => false, toggle: () => {} },
    setAttribute: () => {},
    addEventListener: () => {}
  };
}

function createContext() {
  const elements = new Map();
  const checked = { settingMode: 'preset', preset: 'all' };

  return {
    console,
    document: {
      documentElement: createElement('html'),
      title: '',
      getElementById(id) {
        if (!elements.has(id)) {
          elements.set(id, createElement(id));
        }
        return elements.get(id);
      },
      querySelector(selector) {
        const match = selector.match(/^input\[name="([^"]+)"\]:checked$/);
        if (match) {
          return { value: checked[match[1]] };
        }
        return createElement('query');
      },
      querySelectorAll(selector) {
        if (selector === 'input[name="settingMode"]') {
          return ['preset', 'advanced'].map(value => ({
            value,
            checked: checked.settingMode === value,
            addEventListener: () => {}
          }));
        }

        if (selector === 'input[name="preset"]') {
          return ['all', 'cycle1'].map(value => ({
            value,
            checked: checked.preset === value,
            addEventListener: () => {}
          }));
        }

        if (selector === '[data-answer]') {
          return [];
        }

        return [];
      },
      addEventListener: () => {}
    }
  };
}

const context = createContext();
vm.createContext(context);
vm.runInContext(script, context);

const allNumbers = Array.from({ length: 100 }, (_, n) => n);
const groupNumbers = group => allNumbers.filter(n => context.yearValue(n) === group);
const groupCount = group => groupNumbers(group).length;
const count = (pool, number) => pool.filter(n => n === number).length;

function assertContains(pool, numbers) {
  numbers.forEach(number => assert.ok(pool.includes(number), `missing ${number}`));
}

function assertCounts(pool, entries) {
  entries.forEach(([number, expected]) => {
    assert.strictEqual(count(pool, number), expected, `${number} count`);
  });
}

function assertGroupCount(pool, group, expected) {
  groupNumbers(group).forEach(number => {
    assert.strictEqual(count(pool, number), expected, `group${group} member ${number} count`);
  });
}

const cases = [
  ['all', 100, pool => assertContains(pool, [0, 99])],
  ['all/group1*3', 100 + groupCount(1) * 3],
  ['cycle1/group2*5', 28 + groupCount(2) * 5],
  ['all/!14', 99, pool => assertCounts(pool, [[14, 0]])],
  ['all/doubles*10', 200],
  ['0-27/56-83', 56, pool => assertContains(pool, [0, 27, 56, 83])],
  ['14/27/55', 3, pool => assertContains(pool, [14, 27, 55])],
  ['all/group1*3/group2*3/!14', 186, pool => assertCounts(pool, [[14, 0]])],
  ['group1*3/!group1/all', groupCount(1) * 2 + 100, pool => assertGroupCount(pool, 1, 3)],
  ['group1*5/!group1*3', groupCount(1) * 2, pool => assertGroupCount(pool, 1, 2)],
  ['14*3/!14', 2, pool => assertCounts(pool, [[14, 2]])],
  ['14*3/!14*2', 1, pool => assertCounts(pool, [[14, 1]])],
  ['all//\n/!14', 99, pool => assertCounts(pool, [[14, 0]])],
  ['abc/unknown*5', 100, pool => assertContains(pool, [0, 99])]
];

cases.forEach(([filter, expectedLength, extraAssert]) => {
  const pool = context.parseFilter(filter);
  assert.strictEqual(pool.length, expectedLength, `${filter} length`);
  if (extraAssert) {
    extraAssert(pool);
  }
});
