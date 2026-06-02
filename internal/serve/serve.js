let fetchContent = (u) => {
    fetch("/markdown/" + u)
        .then(r => r.json())
        .then(r => {
            let mdtextarea = document.querySelector('div.doc-preview textarea')
            mdtextarea.value = r.content
            mdtextarea.dispatchEvent(new Event("input", {"bubbles": true}))

            let normalizedPath = u.replace(/\\/g, '')
            document.querySelectorAll('.provider-docs-menu .menu-list-link a').forEach(a => {
                a.classList.remove('active')
            })
            let active = document.querySelector(`.provider-docs-menu a[data-path="${normalizedPath}"]`)
            if (active) active.classList.add('active')
        })

    document.querySelector('div.doc-preview textarea').style.display = "none"
}

let updateMenu = (n) => {
    fetch("/markdown/menu")
        .then(r => r.text())
        .then(r => {
            n.innerHTML = r
            n.querySelectorAll('[data-section]').forEach(wrapper => {
                let link = wrapper.querySelector('.menu-list-category-link')
                let list = wrapper.querySelector('ul.menu-list')
                let icon = wrapper.querySelector('i')
                link.style.cursor = 'pointer'
                link.addEventListener('click', () => {
                    let isExpanded = wrapper.classList.contains('menu-list-category-wrapper')
                    if (isExpanded) {
                        wrapper.classList.remove('menu-list-category-wrapper')
                        if (list) list.style.display = 'none'
                        if (icon) { icon.classList.remove('fa-angle-down'); icon.classList.add('fa-angle-right') }
                    } else {
                        wrapper.classList.add('menu-list-category-wrapper')
                        if (list) list.style.display = ''
                        if (icon) { icon.classList.remove('fa-angle-right'); icon.classList.add('fa-angle-down') }
                    }
                })
            })
        })
}

let textArea = new MutationObserver((mutations, ob) => {
    mutations.forEach((mutation) => {
        if (!mutation.addedNodes) return

        for (let i = 0; i < mutation.addedNodes.length; i++) {
            let node = mutation.addedNodes[i]
            if (node.nodeName === "TEXTAREA") {
                fetchContent("docs/index.md")
                ob.disconnect()
            }
        }
    })
})
let menu = new MutationObserver((mutations, ob) => {
    mutations.forEach((mutation) => {
        if (!mutation.addedNodes) return

        for (let i = 0; i < mutation.addedNodes.length; i++) {
            let node = mutation.addedNodes[i]
            if (node.nodeName === "DIV" && node.getAttribute("class") === "provider-docs-menu") {
                updateMenu(node)
                ob.disconnect()
            }
        }
    })
})

textArea.observe(document.body, {
    childList: true
    , subtree: true
    , attributes: false
    , characterData: false
})
menu.observe(document.body, {
    childList: true
    , subtree: true
    , attributes: false
    , characterData: false
})
