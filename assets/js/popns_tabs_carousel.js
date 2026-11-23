const tabsCarousel = document.querySelector('#tabs');
let isDraggingTabs = false;
let dragStartX = 0;
let dragStartScrollLeft = 0;

tabsCarousel.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;

    isDraggingTabs = true;
    dragStartX = event.clientX;
    dragStartScrollLeft = tabsCarousel.scrollLeft;
    tabsCarousel.classList.add('is-dragging');
    tabsCarousel.setPointerCapture(event.pointerId);
});

tabsCarousel.addEventListener('pointermove', (event) => {
    if (!isDraggingTabs) return;

    tabsCarousel.scrollLeft = dragStartScrollLeft - (event.clientX - dragStartX);
});

function stopDraggingTabs() {
    isDraggingTabs = false;
    tabsCarousel.classList.remove('is-dragging');
}

tabsCarousel.addEventListener('pointerup', stopDraggingTabs);
tabsCarousel.addEventListener('pointercancel', stopDraggingTabs);
