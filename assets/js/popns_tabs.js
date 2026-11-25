const tabList = document.querySelector('#tabs');
const menuContent = document.querySelector('#menu-content');
const csvPaths = {
    tabs: 'menu_data/tabs_order.csv',
    main: 'menu_data/main_menu.csv',
    bowls: 'menu_data/bowls_menu.csv'
};

function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    let afterQuote = false;
    const input = text.replace(/^\uFEFF/, '');

    for (let index = 0; index < input.length; index += 1) {
        const character = input[index];

        if (inQuotes) {
            if (character === '"' && input[index + 1] === '"') {
                field += '"';
                index += 1;
            } else if (character === '"') {
                inQuotes = false;
                afterQuote = true;
            } else {
                field += character;
            }
            continue;
        }

        if (afterQuote && character !== ',' && character !== '\r' && character !== '\n' && !/\s/.test(character)) {
            throw new Error('Unexpected character after a quoted CSV field.');
        }
        if (character === '"' && field === '') {
            inQuotes = true;
        } else if (character === '"') {
            throw new Error('Unexpected quote in an unquoted CSV field.');
        } else if (character === ',' || character === '\r' || character === '\n') {
            row.push(field.trim());
            field = '';
            afterQuote = false;

            if (character !== ',') {
                if (character === '\r' && input[index + 1] === '\n') index += 1;
                if (row.some((value) => value !== '')) rows.push(row);
                row = [];
            }
        } else {
            field += character;
        }
    }

    if (inQuotes) throw new Error('Unclosed quoted CSV field.');
    if (field !== '' || afterQuote || row.length > 0) {
        row.push(field.trim());
        if (row.some((value) => value !== '')) rows.push(row);
    }
    return rows;
}

function readCsv(text, requiredColumns, source) {
    const rows = parseCsv(text);
    if (!rows.length) throw new Error(`${source} is empty.`);

    const headers = rows[0].map((header) => header.toUpperCase());
    if (new Set(headers).size !== headers.length || requiredColumns.some((column) => !headers.includes(column))) {
        throw new Error(`${source} is missing required columns or has duplicate headers.`);
    }

    let malformedRows = 0;
    const records = rows.slice(1).map((values, index) => {
        if (values.length !== headers.length) {
            malformedRows += 1;
            console.warn(`${source}: skipped malformed row ${index + 2} (column count mismatch).`);
            return null;
        }
        return Object.fromEntries(headers.map((header, column) => [header, values[column]]));
    }).filter(Boolean);
    if (malformedRows && records.length === 0) throw new Error(`${source} contains no usable records.`);
    return records;
}

function parseActive(value) {
    const normalized = value.trim().toUpperCase();
    if (normalized === 'TRUE') return true;
    if (normalized === 'FALSE') return false;
    throw new Error('ACTIVE must be TRUE or FALSE.');
}

function normalizeNumber(value, field) {
    const trimmed = value.trim();
    if (!trimmed) return '';
    const leadingDigits = trimmed.match(/^[0-9]+/);
    if (!leadingDigits) throw new Error(`${field} must start with digits.`);

    const number = Number(leadingDigits[0]);
    if (!Number.isSafeInteger(number)) throw new Error(`${field} exceeds the safe integer range.`);
    return String(number);
}

function readMenuItems(text, source) {
    const rows = readCsv(text, ['TITLE', 'ACTIVE', 'CATEGORY'], source);
    const items = [];
    let invalidCount = 0;

    rows.forEach((row, index) => {
        try {
            const item = {
                title: row.TITLE.trim(),
                active: parseActive(row.ACTIVE),
                category: row.CATEGORY.trim(),
                notes: row.NOTES || '',
                allergens: row.ALLERGENS || '',
                description: row.DESCRIPTION || '',
                image: source === 'main_menu.csv' ? imageFilenameFromTitle(row.TITLE) : (row.IMAGE || ''),
                numbers: Object.fromEntries(
                    ['PRICE', 'KCAL', 'PROTEIN', 'CARBS', 'FAT', 'FIBER']
                        .filter((field) => Object.hasOwn(row, field))
                        .map((field) => [field, normalizeNumber(row[field], field)])
                )
            };
            if (!item.title || !item.category) throw new Error('TITLE and CATEGORY are required.');
            items.push(item);
        } catch (error) {
            invalidCount += 1;
            console.warn(`${source}: skipped invalid row ${index + 2}: ${error.message}`);
        }
    });

    if (rows.length && invalidCount === rows.length) {
        throw new Error(`${source} contains no usable records.`);
    }
    return items.filter((item) => item.active);
}

function slugify(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'category';
}

function imageFilenameFromTitle(title) {
    let filename = title.normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'menu_item';

    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/.test(filename)) filename = `_${filename}`;
    return `${filename}.jpg`;
}

function addText(parent, tag, className, value) {
    if (!value) return null;
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = value;
    parent.append(element);
    return element;
}

function renderItem(item) {
    const container = document.createElement('article');
    container.className = 'menu_container';

    if (item.image && /^[^/\\]+$/.test(item.image) && !item.image.includes('..')) {
        const image = document.createElement('img');
        image.alt = '';
        image.width = 1000;
        image.height = 1000;
        image.loading = 'lazy';
        image.addEventListener('error', () => image.remove());
        image.src = `menu_imgs/${encodeURIComponent(item.image)}`;
        container.append(image);
    }

    const title = document.createElement('div');
    title.className = 'item_title';
    addText(title, 'h4', '', item.title);
    addText(title, 'h4', 'price', item.numbers.PRICE);
    container.append(title);
    addText(container, 'p', 'description', item.description);
    addText(container, 'p', 'popns_notes', item.notes);
    addText(container, 'p', 'allergens', item.allergens ? `Allergens: ${item.allergens}` : '');


    const nutrition = ['KCAL', 'PROTEIN', 'CARBS', 'FAT', 'FIBER']
        .filter((field) => item.numbers[field]);
    if (nutrition.length) {
        const details = document.createElement('dl');
        details.className = 'nutrition';
        nutrition.forEach((field) => {
            addText(details, 'dt', '', field.toLowerCase());
            addText(details, 'dd', '', item.numbers[field]);
        });
        container.append(details);
    }

    return container;
}

function selectTab(tab) {
    tabList.querySelectorAll('[role="tab"]').forEach((button) => {
        const selected = button === tab;
        button.setAttribute('aria-selected', String(selected));
        button.tabIndex = selected ? 0 : -1;
        document.getElementById(button.getAttribute('aria-controls')).hidden = !selected;
    });
}

function handleTabKeydown(event) {
    const tabs = [...tabList.querySelectorAll('[role="tab"]')];
    const currentIndex = tabs.indexOf(document.activeElement);
    if (currentIndex < 0) return;

    let nextIndex;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabs.length - 1;
    else return;

    event.preventDefault();
    tabs[nextIndex].focus();
    selectTab(tabs[nextIndex]);
}

function renderMenu(tabRows, mainItems, bowlItems) {
    const seenCategories = new Set();
    const categories = [];
    tabRows.forEach((row, index) => {
        try {
            if (!parseActive(row.ACTIVE)) return;
            const category = row.CATEGORY.trim();
            if (!category) throw new Error('CATEGORY is required.');
            if (seenCategories.has(category)) {
                console.warn(`tabs_order.csv: ignored duplicate category "${category}" on row ${index + 2}.`);
                return;
            }
            seenCategories.add(category);
            const items = [
                ...mainItems.filter((item) => item.category === category),
                ...bowlItems.filter((item) => item.category === category)
            ];
            if (items.length) categories.push({ category, items });
        } catch (error) {
            console.warn(`tabs_order.csv: skipped invalid row ${index + 2}: ${error.message}`);
        }
    });

    tabList.replaceChildren();
    menuContent.replaceChildren();
    menuContent.setAttribute('aria-busy', 'false');
    if (!categories.length) {
        addText(menuContent, 'p', '', 'No menu items are currently available.');
        return;
    }

    const visibleCategories = new Set(categories.map(({ category }) => category));
    const bowlOptionGroups = [];
    bowlItems.forEach((item) => {
        if (visibleCategories.has(item.category)) return;
        let group = bowlOptionGroups.find(({ category }) => category === item.category);
        if (!group) {
            group = { category: item.category, items: [] };
            bowlOptionGroups.push(group);
        }
        group.items.push(item);
    });

    categories.forEach(({ category, items }, index) => {
        const tabId = `menu-tab-${index}-${slugify(category)}`;
        const panelId = `menu-panel-${index}-${slugify(category)}`;
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.className = 'tab';
        tab.id = tabId;
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-controls', panelId);
        tab.setAttribute('aria-selected', String(index === 0));
        tab.tabIndex = index === 0 ? 0 : -1;

        const icon = document.createElement('span');
        icon.className = 'tab_icon';
        const image = document.createElement('img');
        image.src = `menu_imgs/tabs/tabs_highlight_${slugify(category).replace(/-/g, '_')}.png`;
        image.alt = '';
        image.width = 50;
        image.height = 50;
        image.addEventListener('error', () => icon.remove(), { once: true });
        icon.append(image);
        tab.append(icon);
        addText(tab, 'span', 'tab_label', category);
        tab.addEventListener('click', () => selectTab(tab));
        tabList.append(tab);

        const panel = document.createElement('section');
        panel.id = panelId;
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', tabId);
        panel.tabIndex = 0;
        panel.hidden = index !== 0;

        const heading = document.createElement('div');
        heading.className = 'section_pattern';
        const pattern = document.createElement('div');
        pattern.className = 'popns_pattern';
        const patternImage = document.createElement('img');
        patternImage.src = `assets/imgs/popns_pattern_${(index % 5) + 1}.png`;
        patternImage.alt = '';
        patternImage.width = 50;
        patternImage.height = 100;
        pattern.append(patternImage);
        heading.append(pattern);
        addText(heading, 'h2', '', category);
        panel.append(heading);
        items.forEach((item) => panel.append(renderItem(item)));
        if (category === 'Bowls') {
            bowlOptionGroups.forEach(({ category: groupCategory, items: groupItems }) => {
                addText(panel, 'h3', 'bowl_option_heading', groupCategory);
                groupItems.forEach((item) => panel.append(renderItem(item)));
            });
        }
        menuContent.append(panel);
    });

    selectTab(tabList.querySelector('[role="tab"]'));
}

function showFailure(error) {
    console.error('Unable to load the menu.', error);
    tabList.replaceChildren();
    menuContent.replaceChildren();
    menuContent.setAttribute('aria-busy', 'false');
    addText(menuContent, 'p', '', 'The menu could not be loaded. Please try again.');
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = 'Retry';
    retry.addEventListener('click', loadMenu);
    menuContent.append(retry);
}

async function loadMenu() {
    menuContent.setAttribute('aria-busy', 'true');
    menuContent.replaceChildren();
    addText(menuContent, 'p', '', 'Loading menu…');
    try {
        const responses = await Promise.all(
            Object.values(csvPaths).map((path) => fetch(path))
        );
        const failedResponse = responses.find((response) => !response.ok);
        if (failedResponse) throw new Error(`Request failed (${failedResponse.status}).`);

        const [tabsText, mainText, bowlsText] = await Promise.all(responses.map((response) => response.text()));
        const tabs = readCsv(tabsText, ['CATEGORY', 'ACTIVE'], 'tabs_order.csv');
        const mainItems = readMenuItems(mainText, 'main_menu.csv');
        const bowlItems = readMenuItems(bowlsText, 'bowls_menu.csv');
        tabs.forEach((row, index) => {
            try {
                parseActive(row.ACTIVE);
                if (!row.CATEGORY.trim()) throw new Error('CATEGORY is required.');
            } catch (error) {
                console.warn(`tabs_order.csv: skipped invalid row ${index + 2}: ${error.message}`);
            }
        });
        if (tabs.length && tabs.every((row) => {
            try {
                parseActive(row.ACTIVE);
                return !row.CATEGORY.trim();
            } catch {
                return true;
            }
        })) throw new Error('tabs_order.csv contains no usable records.');
        renderMenu(tabs, mainItems, bowlItems);
    } catch (error) {
        showFailure(error);
    }
}

tabList.addEventListener('keydown', handleTabKeydown);
loadMenu();
