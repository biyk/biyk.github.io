import {CONFIG} from "../consts.js";
import {Spells} from "../spells.js";

export function displaySpells() {
    const list = document.getElementById('my-spell-list');
    list.innerHTML = '';
    this.spells.forEach((spell) => {
        const listItem = document.createElement('li');
        const span = document.createElement('span');
        span.textContent = `[${spell.ac}] ${spell.name}` + (spell.ritual?'*':'');
        span.onclick = () => this.infoSpell(spell.name);
        listItem.appendChild(span);

        const removeSpan = document.createElement('span');
        removeSpan.innerHTML = ' (-)';
        removeSpan.addEventListener('click', async () => await this.removeSpell(spell));
        listItem.appendChild(removeSpan);
        list.appendChild(listItem);
    });
}
export function displayRes() {
    const list = document.getElementById('my-res-list');
    list.innerHTML = '';
    let that = this;
    this.resourses.forEach((res, index) => {
        const listItem = document.createElement('li');
        const span = document.createElement('span');
        span.textContent = `${res.name}`;
        listItem.appendChild(span);


        if (res.count > 5){
            const checkbox = document.createElement('input');
            checkbox.type = 'number';
            checkbox.dataset.value = res.count;
            checkbox.dataset.reset = res.reset;
            checkbox.value = res.used;
            checkbox.onchange = async function () {
                that.resourses[index].used = checkbox.value;
                await that.saveResourses();
            }
            listItem.appendChild(checkbox);
        } else {
            let used = res.used;
            for (let i=1; i <= res.count; i++){
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.dataset.reset = res.reset;
                checkbox.dataset.id = index;
                checkbox.name = res.name;
                checkbox.checked = used-- > 0;
                listItem.appendChild(checkbox);
                checkbox.onchange = async function () {
                    that.resourses[index].used = document.querySelectorAll('[name="' + res.name + '"]:checked').length;
                    await that.saveResourses();
                }
            }
        }


        const removeSpan = document.createElement('span');
        removeSpan.innerHTML = ' (-)';
        removeSpan.addEventListener('click', async () => await this.removeRes(res));
        listItem.appendChild(removeSpan);
        list.appendChild(listItem);
    });
}

export function displaySkills() {
    const list = document.getElementById('my-skill-list');
    list.innerHTML = '';
    this.skills.forEach((res) => {
        const listItem = document.createElement('li');
        const span = document.createElement('span');
        span.textContent = `${res.name}`;
        listItem.appendChild(span);
        listItem.dataset.text = res.text;
        span.onclick = ()=>{
           this.infoSkill(res);
        }

        const removeSpan = document.createElement('span');
        removeSpan.innerHTML = ' (-)';
        removeSpan.addEventListener('click', async () => await this.removeSkill(res));
        listItem.appendChild(removeSpan);
        list.appendChild(listItem);
    });
}

export function renderSpellMenu() {
    const sidebar = document.createElement('div');
    sidebar.classList.add('spells-menu', 'side-menu');

    //spells
    const spellList = document.createElement('ul');
    spellList.id = 'my-spell-list';
    sidebar.appendChild(spellList);


    // Search Field
    const searchField = document.createElement('input');
    const searchLabel = document.createElement('label');
    searchLabel.textContent = 'Search for items';
    searchField.type = 'text';
    searchField.placeholder = 'Название заклинания';
    searchField.id = 'spell-search';
    searchLabel.appendChild(searchField);
    sidebar.appendChild(searchLabel);

    //search-list
    const searchResult = document.createElement('ul');
    searchResult.id = 'spell-list';
    sidebar.appendChild(searchResult);

    sidebar.appendChild(document.createElement('hr'));


    const title = document.createElement('div');
    title.innerHTML = 'Ресурсы';
    CONFIG.reset.forEach(elem => {
        const button =  document.createElement('button');
        button.innerHTML = elem.name;
        button.value = elem.code;
        button.type = 'button';
        button.onclick = async () => {
            document.querySelectorAll(`[data-reset="${elem.code}"]`).forEach(elem => {
                let name = elem.name;
                if (elem.type === 'checkbox') {
                    elem.checked = false;
                } else {
                    elem.value = elem.dataset.value;
                }

                this.resourses.forEach( (e)=> {
                    if (e.name === name) {
                        e.used = 0;
                    }
                })

            });
            if (elem.code === 'long') {
                document.querySelectorAll(`[data-reset="short"]`).forEach(elem => {
                    if (elem.type === 'checkbox') {
                        elem.checked = false;
                    } else {
                        elem.value = elem.dataset.value;
                    }

                    this.resourses.forEach( (e)=> {
                        if (e.name === name) {
                            e.used = 0;
                        }
                    })
                });
            }

            console.log(this.resourses);
            setTimeout(()=>{
                window.mapManager.Spells.saveResourses();

            },0)


        }
        title.appendChild(button);

    });
    sidebar.appendChild(title)
    //spells
    const resList = document.createElement('ul');
    resList.id = 'my-res-list';
    sidebar.appendChild(resList);

    //ресурсы
    const addButton = document.createElement('button');
    addButton.textContent = 'Добавить ресурс';
    addButton.addEventListener('click', (e)=>{

        //показываем форму
        const form= document.createElement('form');
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Название ресурса';

        const input_count = document.createElement('input');
        input_count.type = 'number';
        input_count.placeholder = 'Количество';

        const select_reset = document.createElement('select');

        CONFIG.reset.forEach(elem => {
            const option =  document.createElement('option');
            option.innerHTML = elem.name;
            option.value = elem.code;
            select_reset.appendChild(option)
        });


        const button = document.createElement('button');
        button.innerHTML = '+';
        button.onclick = async (e) => {
            e.preventDefault();
            await this.addResource({
                name: input.value,
                count: input_count.value,
                reset: select_reset.value,
            });
            form.remove();
            this.displayRes();
        };

        form.append(input);
        form.append(input_count);
        form.append(select_reset);
        form.append(button);
        addButton.after(form)
    });

    sidebar.appendChild(addButton);
    sidebar.appendChild(document.createElement('hr'));

    //навыки
    const addSkillButton = document.createElement('button');
    addSkillButton.textContent = 'Добавить навык';
    addSkillButton.onclick = (e)=> {
        e.preventDefault();
        //показываем форму
        const form= document.createElement('form');
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Название навыка';

        const textarea = document.createElement('textarea');
        textarea.placeholder = 'Описание';
        textarea.style.display = 'grid';

        const button = document.createElement('button');
        button.innerHTML = '+';
        button.onclick = async (e) => {
            e.preventDefault();
            await this.addSkill({
                name: input.value,
                text: textarea.value,
            });
            form.remove();
        };

        form.append(input);
        form.append(textarea);
        form.append(button);
        addSkillButton.after(form)
    }

    const skillList = document.createElement('ul');
    skillList.id = 'my-skill-list';
    sidebar.appendChild(skillList);
    sidebar.appendChild(addSkillButton);

    document.body.appendChild(sidebar);
    document.body.dispatchEvent(new Event('ready_spells'));
}