
let emojiData = null;
let loadPromise = null;

async function loadEmojiData() {
  if (emojiData) return emojiData;
  if (!loadPromise) {
	loadPromise = fetch('/file/js/emoji.json')
	  .then(res => res.json())
	  .then(data => {
		emojiData = data;
		return data;
	  });
  }
  return loadPromise;
}

function getCategories(data) {
  const seen = new Set();
  const cats = [];
  for (const e of data) {
	if (!seen.has(e.group)) {
	  seen.add(e.group);
	  cats.push(e.group);
	}
  }
  return cats;
}

function filterEmoji(data, query) {
  if (!query) return data;
  const q = query.toLowerCase();
  return data.filter(e => e.name.toLowerCase().includes(q));
}

function buildPickerDOM(data, opts) {
  const wrapper = document.createElement('div');
  wrapper.className = 'emoji-picker';

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'search emoji...';
  searchInput.className = 'emoji-search';

  const tabsBar = document.createElement('div');
  tabsBar.className = 'emoji-tabs';

  const grid = document.createElement('div');
  grid.className = 'emoji-grid';

  const categories = getCategories(data);
  let activeCategory = categories[0];

  function renderGrid(list) {
	grid.innerHTML = '';
	for (const e of list) {
	  const btn = document.createElement('button');
	  btn.className = 'emoji-btn';
	  btn.textContent = e.char;
	  btn.title = e.name;
	  btn.addEventListener('click', () => {
          console.log('emoji picker opts', opts)
          if (opts.targetInput !== undefined) {
              insertText(targetInput, e.char);
          } else {
            console.log('here!')
            opts.socket.emit('react', {id: opts.id, reaction: e.char, channel: opts.channel})
            close();
        }
	  });
	  grid.appendChild(btn);
	}
  }

  function showCategory(cat) {
	activeCategory = cat;
	renderGrid(data.filter(e => e.group === cat));
	[...tabsBar.children].forEach(tab => {
	  tab.classList.toggle('active', tab.dataset.cat === cat);
	});
  }

  for (const cat of categories) {
	const tab = document.createElement('button');
	tab.className = 'emoji-tab';
	tab.textContent = cat.split(' ')[0]; 
	tab.dataset.cat = cat;
	tab.addEventListener('click', () => showCategory(cat));
	tabsBar.appendChild(tab);
  }

  searchInput.addEventListener('input', () => {
	const query = searchInput.value.trim();
	if (query) {
	  renderGrid(filterEmoji(data, query));
	} else {
	  showCategory(activeCategory);
	}
  });

  wrapper.appendChild(searchInput);
  wrapper.appendChild(tabsBar);
  wrapper.appendChild(grid);

  showCategory(activeCategory);

  return wrapper;
}

function insertText(input, text) {
  const start = input.selectionStart;
  const end = input.selectionEnd;
  const val = input.value;
  input.value = val.slice(0, start) + text + val.slice(end);
  input.selectionStart = input.selectionEnd = start + text.length;
  input.focus();
}

let currentPicker = null;

export async function open(triggerEl, opts) {
  if (currentPicker) {
	close();
	return;
  }
  const data = await loadEmojiData();
  const picker = buildPickerDOM(data, opts);
  document.body.appendChild(picker);

  const rect = triggerEl.getBoundingClientRect();
  picker.style.position = 'absolute';
//   picker.style.top = `${window.innerHeight - rect.top}px`;
//   picker.style.right = `${rect.left}px`;
  picker.style.top = `0px`;
  picker.style.right = `0px`;

  currentPicker = picker;

  setTimeout(() => {
	document.addEventListener('click', outsideClickHandler);
  }, 0);
}

function outsideClickHandler(e) {
  if (currentPicker && !currentPicker.contains(e.target)) {
	close();
  }
}

function close() {
  if (currentPicker) {
	currentPicker.remove();
	currentPicker = null;
	document.removeEventListener('click', outsideClickHandler);
  }
}

export default { open, close };