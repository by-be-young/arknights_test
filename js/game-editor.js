// 简易 Operators 编辑器脚本
(function () {
    const deployPosItems = ['近战位', '远程位'];
    const damageTypeItems = ['物理伤害', '法术伤害', '真实伤害', '元素伤害', '元素损伤', '持续伤害'];
    const specialModuleItems = ['集成战略特限模组/特勤模组', '生息演算特限模组/特勤模组'];

    const yigeItems = ['有异格', '无异格'];
    const summonDeployItems = ['有可手动部署的召唤物', '没有可手动部署的召唤物'];

    const skillTypeItems = ['自动回复', '受击回复', '攻击回复', '被动', '自动触发', '手动触发', '弹药'];
    const limitedItems = ['新春限定', '周年/半周年限定', '夏季限定', '联动限定'];

    const selfSurviveItems = ['为自身治疗或生命回复', '恢复或治疗自身元素损伤', '庇护自身或使自身受伤减免', '使自身锁血', '使自身闪避/抵挡/格挡', '为自身提供护盾或屏障', '使自身受到治疗或生命回复效果提升', '使自身获得抵抗/免疫或解除异常状态'];
    const selfSpecialItems = ['迷彩', '隐匿', '嘲讽', '负嘲讽', '起飞', '禁疗'];

    const assistHealItems = ['为友方治疗', '使友方生命回复', '恢复或治疗友方元素损伤', '庇护友方或使友方受伤减免', '使友方锁血', '使友方闪避/抵挡/格挡', '为友方提供护盾或屏障', '使友方受到治疗或生命回复效果提升', '使友方获得抵抗/免疫或解除异常状态'];
    const assistBuffItems = ['辅助友方技力回复或初始技力', '为友方提高攻速', '使友方基础属性提高或造成伤害提升', '使友方再部署时间缩短', '影响友方弹药数量', '使友方部署费用减少或部署后返还费用'];
    const assistDebuffItems = ['使敌方隐匿效果失效', '使敌方命中率下降', '降低敌方基础属性', '使敌方受到治疗效果降低', '使敌方攻速降低', '使敌方获得脆弱或受伤增加', '使敌方失重'];
    const assistControlItems = ['晕眩', '位移/传送', '沉默', '束缚', '寒冷/冻结', '浮空', '战栗', '恐惧', '麻痹', '诱导', '沉睡', '停顿/降低移动速度'];

    let operators = [];
    let currentIndex = -1;

    function el(id) { return document.getElementById(id) }

    function makeCheckboxList(containerId, items) {
        const c = el(containerId);
        if (!c) return;
        c.innerHTML = '';
        items.forEach(it => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'chip';
            btn.dataset.key = it;
            // 对特定提示词追加补充说明，但保持 dataset.key 不变以便数据存储一致
            btn.textContent = it;
            btn.addEventListener('click', () => btn.classList.toggle('selected'));
            c.appendChild(btn);
        });
    }

    function initUI() {
        makeCheckboxList('deployPos', deployPosItems);
        makeCheckboxList('damageTypes', damageTypeItems);
        makeCheckboxList('specialModule', specialModuleItems);
        makeCheckboxList('skillTypes', skillTypeItems);
        makeCheckboxList('limitedTypes', limitedItems);
        makeCheckboxList('hasYige', yigeItems);
        makeCheckboxList('deployableSummon', summonDeployItems);
        makeCheckboxList('selfSurvive', selfSurviveItems);
        makeCheckboxList('selfSpecial', selfSpecialItems);
        makeCheckboxList('assistHeal', assistHealItems);
        makeCheckboxList('assistBuff', assistBuffItems);
        makeCheckboxList('assistDebuff', assistDebuffItems);
        makeCheckboxList('assistControl', assistControlItems);

        const btnLoadRemote = el('btnLoadRemote');
        if (btnLoadRemote) btnLoadRemote.addEventListener('click', () => { autoSaveIfDirty(); loadRemote(); });
        const fileInput = el('fileInput');
        if (fileInput) fileInput.addEventListener('change', e => { autoSaveIfDirty(); loadFromFile(e); });
        const btnNew = el('btnNew');
        if (btnNew) btnNew.addEventListener('click', () => {
            autoSaveIfDirty();
            operators.push({ name: '新干员' }); renderList(); selectIndex(operators.length - 1);
            const leftList = document.querySelector('.list');
            const rightPanel = document.querySelector('.editor');
            if (leftList) leftList.scrollTop = leftList.scrollHeight;
            if (rightPanel) rightPanel.scrollTop = 0;
        });
        const btnSave = el('btnSave'); if (btnSave) btnSave.addEventListener('click', saveCurrent);
        const btnDelete = el('btnDelete'); if (btnDelete) btnDelete.addEventListener('click', deleteCurrent);
        const btnExport = el('btnExport'); if (btnExport) btnExport.addEventListener('click', () => { autoSaveIfDirty(); exportOperators(); });
        if (el('btnWriteFile')) el('btnWriteFile').addEventListener('click', () => { autoSaveIfDirty(); writeToFile(); });

        // Enter 键在 name/job 输入框间跳转
        const nameEl = el('name'), j1 = el('job1'), j2 = el('job2');
        if (nameEl && j1 && j2) {
            nameEl.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); j1.focus(); } });
            j1.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); j2.focus(); } });
            j2.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); const firstChip = document.querySelector('.checkbox-grid .chip'); if (firstChip) firstChip.focus(); } });
        }

        // 全局点击捕获：当在编辑器或工具栏中点击除信息填写行以外的按钮时，先自动保存再执行按钮逻辑
        const infoGroup = document.querySelector('.editor .group.form-row');
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            if (!btn.closest('.toolbar') && !btn.closest('.editor')) return;
            if (infoGroup && infoGroup.contains(btn)) return;
            if (btn.id === 'btnSave' || btn.id === 'btnDelete') return;
            autoSaveIfDirty();
        }, true);
    }

    function isDirty() {
        if (currentIndex < 0) return false;
        const orig = operators[currentIndex] || {};
        const tmp = {};
        tmp.name = (el('name') && el('name').value) || '';
        const j1 = (el('job1') && el('job1').value.trim()) || '';
        const j2 = (el('job2') && el('job2').value.trim()) || '';
        if (j1 || j2) { tmp['职业'] = {}; if (j1) tmp['职业'][j1] = 1; if (j2) tmp['职业'][j2] = 1 }

        const deploy = collectChecked('deployPos');
        const damage = collectChecked('damageTypes');
        const specialModuleVals = collectChecked('specialModule');
        const skill = collectChecked('skillTypes');
        const limited = collectChecked('limitedTypes');
        const yige = collectChecked('hasYige');
        const deployableSummon = collectChecked('deployableSummon');
        if (deploy || damage || skill || limited || yige || deployableSummon || specialModuleVals) tmp['特性'] = {};
        if (deploy) tmp['特性']['部署位置'] = deploy;
        if (damage) tmp['特性']['伤害类型'] = damage;
        if (skill) tmp['特性']['技能类型'] = skill;
        if (limited) tmp['特性']['限定干员'] = limited;
        if (yige) tmp['特性']['有无异格'] = yige;
        if (deployableSummon) tmp['特性']['有无可部署召唤物'] = deployableSummon;
        if (specialModuleVals) tmp['特性']['特限模组/特勤模组'] = specialModuleVals;

        const survive = collectChecked('selfSurvive');
        const special = collectChecked('selfSpecial');
        if (survive || special) tmp['自身能力'] = {};
        if (survive) tmp['自身能力']['生存能力'] = survive;
        if (special) tmp['自身能力']['特殊被选中效果'] = special;

        const heal = collectChecked('assistHeal');
        const buff = collectChecked('assistBuff');
        const debuff = collectChecked('assistDebuff');
        const control = collectChecked('assistControl');
        if (heal || buff || debuff || control) tmp['辅助能力'] = {};
        if (heal) tmp['辅助能力']['保人能力'] = heal;
        if (buff) tmp['辅助能力']['增益能力'] = buff;
        if (debuff) tmp['辅助能力']['削弱能力'] = debuff;
        if (control) tmp['辅助能力']['控制能力'] = control;

        try {
            return JSON.stringify(tmp) !== JSON.stringify(orig);
        } catch (e) { return false; }
    }

    function autoSaveIfDirty() {
        if (currentIndex >= 0 && isDirty()) {
            saveCurrent();
        }
    }

    function loadRemote() {
        fetch('js/operators.js').then(r => r.text()).then(t => {
            try { eval(t); }
            catch (e) { console.warn('eval error', e); }
            operators = window.gameOperators && Array.isArray(window.gameOperators) ? window.gameOperators : [];
            renderList();
            if (operators.length) selectIndex(0);
        }).catch(err => { alert('加载失败：' + err) });
    }

    function loadFromFile(e) {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = function () {
            try { eval(r.result); }
            catch (e) { console.warn('eval error', e); }
            operators = window.gameOperators && Array.isArray(window.gameOperators) ? window.gameOperators : [];
            renderList(); if (operators.length) selectIndex(0);
        };
        r.readAsText(f, 'utf-8');
    }

    function renderList() {
        const ul = el('opList'); if (!ul) return; ul.innerHTML = '';
        operators.forEach((op, i) => {
            const li = document.createElement('li');
            const btn = document.createElement('button');
            btn.className = 'op-btn';
            btn.textContent = op.name || ('#' + i);
            btn.dataset.index = i;
            btn.addEventListener('click', () => {
                autoSaveIfDirty();
                selectIndex(i);
            });
            li.appendChild(btn);
            ul.appendChild(li);
        })
        updateListSelection();
    }

    function updateListSelection() {
        const ul = el('opList'); if (!ul) return;
        Array.from(ul.querySelectorAll('button.op-btn')).forEach(b => {
            const idx = Number(b.dataset.index);
            if (idx === currentIndex) b.classList.add('selected'); else b.classList.remove('selected');
        });
    }

    function selectIndex(i) {
        currentIndex = i;
        const op = operators[i] || {};
        if (el('name')) el('name').value = op.name || '';
        const jobKeys = op['职业'] ? Object.keys(op['职业']) : [];
        if (el('job1')) el('job1').value = jobKeys[0] || '';
        if (el('job2')) el('job2').value = jobKeys[1] || '';

        function setCheckboxes(containerId, obj) {
            const c = el(containerId);
            if (!c) return;
            Array.from(c.querySelectorAll('.chip')).forEach(chip => {
                const selected = !!(obj && Object.prototype.hasOwnProperty.call(obj, chip.dataset.key) && obj[chip.dataset.key]);
                chip.classList.toggle('selected', selected);
            });
        }

        const 特性 = op['特性'] || {};
        setCheckboxes('deployPos', 特性['部署位置']);
        setCheckboxes('damageTypes', 特性['伤害类型']);
        setCheckboxes('specialModule', 特性['特限模组/特勤模组']);
        setCheckboxes('skillTypes', 特性['技能类型']);
        setCheckboxes('limitedTypes', 特性['限定干员']);
        setCheckboxes('hasYige', 特性['有无异格']);
        setCheckboxes('deployableSummon', 特性['有无可部署召唤物']);

        const 自身能力 = op['自身能力'] || {};
        setCheckboxes('selfSurvive', 自身能力['生存能力']);
        setCheckboxes('selfSpecial', 自身能力['特殊被选中效果']);

        const 辅助能力 = op['辅助能力'] || {};
        setCheckboxes('assistHeal', 辅助能力['保人能力']);
        setCheckboxes('assistBuff', 辅助能力['增益能力']);
        setCheckboxes('assistDebuff', 辅助能力['削弱能力']);
        setCheckboxes('assistControl', 辅助能力['控制能力']);
        updateListSelection();
    }

    function collectChecked(containerId) {
        const c = el(containerId); if (!c) return undefined;
        const out = {};
        Array.from(c.querySelectorAll('.chip.selected')).forEach(chip => {
            out[chip.dataset.key] = 1;
        });
        return Object.keys(out).length ? out : undefined;
    }

    function saveCurrent() {
        if (currentIndex < 0) { alert('未选择词条'); return; }
        const op = {};
        op.name = (el('name') && el('name').value) || '';
        const j1 = (el('job1') && el('job1').value.trim()) || '';
        const j2 = (el('job2') && el('job2').value.trim()) || '';
        if (j1 || j2) { op['职业'] = {}; if (j1) op['职业'][j1] = 1; if (j2) op['职业'][j2] = 1 }

        const 部署位置 = collectChecked('deployPos');
        const 伤害类型 = collectChecked('damageTypes');
        const specialModuleVals = collectChecked('specialModule');
        const 技能类型 = collectChecked('skillTypes');
        const 限定干员 = collectChecked('limitedTypes');
        const 有无异格 = collectChecked('hasYige');
        const 有无可部署召唤物 = collectChecked('deployableSummon');
        if (部署位置 || 伤害类型 || 技能类型 || 限定干员 || 有无异格 || 有无可部署召唤物 || specialModuleVals) op['特性'] = {};
        if (部署位置) op['特性']['部署位置'] = 部署位置;
        if (伤害类型) op['特性']['伤害类型'] = 伤害类型;
        if (技能类型) op['特性']['技能类型'] = 技能类型;
        if (限定干员) op['特性']['限定干员'] = 限定干员;
        if (有无异格) op['特性']['有无异格'] = 有无异格;
        if (有无可部署召唤物) op['特性']['有无可部署召唤物'] = 有无可部署召唤物;
        if (specialModuleVals) op['特性']['特限模组/特勤模组'] = specialModuleVals;

        const 生存能力 = collectChecked('selfSurvive');
        const 特殊被选中效果 = collectChecked('selfSpecial');
        if (生存能力 || 特殊被选中效果) op['自身能力'] = {};
        if (生存能力) op['自身能力']['生存能力'] = 生存能力;
        if (特殊被选中效果) op['自身能力']['特殊被选中效果'] = 特殊被选中效果;

        const 保人能力 = collectChecked('assistHeal');
        const 增益能力 = collectChecked('assistBuff');
        const 削弱能力 = collectChecked('assistDebuff');
        const 控制能力 = collectChecked('assistControl');
        if (保人能力 || 增益能力 || 削弱能力 || 控制能力) op['辅助能力'] = {};
        if (保人能力) op['辅助能力']['保人能力'] = 保人能力;
        if (增益能力) op['辅助能力']['增益能力'] = 增益能力;
        if (削弱能力) op['辅助能力']['削弱能力'] = 削弱能力;
        if (控制能力) op['辅助能力']['控制能力'] = 控制能力;

        operators[currentIndex] = op;
        renderList();
        selectIndex(currentIndex);
    }

    function deleteCurrent() {
        if (currentIndex < 0) return; operators.splice(currentIndex, 1);
        currentIndex = -1; renderList(); if (el('exportResult')) el('exportResult').value = '';
    }

    function exportOperators() {
        const js = generateExportString();
        if (el('exportResult')) el('exportResult').value = js;
        navigator.clipboard && navigator.clipboard.writeText(js).then(() => {
            alert('已复制到剪贴板，可粘贴到 js/operators.js');
        }, () => {
            alert('复制失败，请手动复制下方文本');
        });
    }

    function generateExportString() {
        const json = JSON.stringify(operators, null, 4);
        return 'window.gameOperators = ' + json + ';';
    }

    async function writeToFile() {
        const js = generateExportString();
        try {
            if (window.showOpenFilePicker) {
                const handles = await window.showOpenFilePicker({
                    multiple: false,
                    types: [{ description: 'JavaScript', accept: { 'text/javascript': ['.js'] } }]
                });
                const handle = handles[0];
                const writable = await handle.createWritable();
                await writable.write(js);
                await writable.close();
                alert('已写入：' + (handle.name || 'selected file'));
                return;
            }
            if (window.showSaveFilePicker) {
                const handle = await window.showSaveFilePicker({ suggestedName: 'operators.js', types: [{ description: 'JavaScript', accept: { 'text/javascript': ['.js'] } }] });
                const writable = await handle.createWritable();
                await writable.write(js);
                await writable.close();
                alert('已保存：' + (handle.name || 'operators.js'));
                return;
            }
        } catch (e) {
            console.warn('FS API failed', e);
            alert('写入失败：' + e);
        }
        try {
            const blob = new Blob([js], { type: 'text/javascript' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'operators.js';
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (e) {
            alert('下载失败：' + e);
        }
    }

    // 初始化
    window.addEventListener('DOMContentLoaded', () => {
        initUI();
    });
})();