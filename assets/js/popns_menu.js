const menuToggle = document.querySelector('.popns_menu_toggle');
const menu = document.querySelector('#popns_menu');
const closeButton = menu.querySelector('.popns_menu_close');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let closing = false;

function closeMenu() {
    if (!menu.open || closing) return;
    closing = true;
    menu.classList.remove('is-open');
    menuToggle.setAttribute('aria-expanded', 'false');

    window.setTimeout(() => {
        menu.close();
        document.body.classList.remove('popns_menu_open');
        closing = false;
        menuToggle.focus();
    }, reducedMotion.matches ? 0 : 250);
}

menuToggle.addEventListener('click', () => {
    if (menu.open) return;
    menu.showModal();
    document.body.classList.add('popns_menu_open');
    menuToggle.setAttribute('aria-expanded', 'true');
    // Commit the offscreen position before starting the entrance transition.
    menu.getBoundingClientRect();
    menu.classList.add('is-open');
});

closeButton.addEventListener('click', closeMenu);
menu.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeMenu();
});
menu.addEventListener('click', (event) => {
    const bounds = menu.getBoundingClientRect();
    const outside = event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom;

    if (outside || event.target.closest('a')) closeMenu();
});
