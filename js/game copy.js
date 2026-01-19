
// game.js
/* 全局变量 */
let allOperators = [];          // 所有干员原始数据
let pool = [];                  // 本局 32 名干员
let answer = null;              // 本局答案干员
let hints = [];                 // 本局已发布提示队列
let currentHintIndex = 0;       // 当前提示序号（从 0 开始）
let excluded = new Set();       // 被右键排除的干员索引
let selectedIndex = null;       // 左键选中的干员索引
let gameStarted = false;

/* 统计 */
let totalGames = 0;
let winGames = 0;
let totalHintsUsed = 0;
let hintsUsedForCorrect = 0;

/* DOM */
const gridEl = document.getElementById('operatorsGrid');
const hintTextEl = document.getElementById('hintText');
const hintDetailsEl = document.getElementById('hintDetails');
const currentHintEl = document.getElementById('currentHint');
const winRateEl = document.getElementById('winRate');
const avgHintsEl = document.getElementById('avgHints');
const resultAreaEl = document.getElementById('resultArea');
const startBtn = document.getElementById('startBtn');
const nextHintBtn = document.getElementById('nextHintBtn');
const submitBtn = document.getElementById('submitBtn');
const showAllHintsBtn = document.getElementById('showAllHintsBtn');
const allHintsPanel = document.getElementById('allHintsPanel');
const allHintsList = document.getElementById('allHintsList');

/* ========================== 初始化 ========================== */
function loadOperators() {
    // 依赖 operators.js 里定义的 window.gameOperators
    allOperators = window.gameOperators || [];
}

/* ========================== 工具函数 ========================== */
function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/* 判断干员是否满足某条提示 */
function matchHint(op, hint) {
    // 统一通过路径查找值，支持任意层级的同级多值结构
    const { type, path, negative } = hint;
    const fullPath = [type, ...path];
    // 特殊路径支持：如果最后一项是 '__multiple__'，表示需要匹配拥有>1 个子项的情况（用于“不止一种控制能力”）
    if (fullPath.length && fullPath[fullPath.length - 1] === '__multiple__') {
        const nodePath = fullPath.slice(0, -1);
        const node = getNested(op, nodePath);
        if (!node || typeof node !== 'object') return false;
        const count = Object.values(node).filter(v => v === 1).length;
        return count > 1;
    }
    const val = getNested(op, fullPath);
    // 负面提示：在对象不存在或没有任何子项为 1 时视为匹配
    if (negative) {
        if (val === undefined) return true;
        if (val === 1) return false;
        if (val && typeof val === 'object') return !Object.values(val).some(v => v === 1);
        return true;
    }
    if (val === 1) return true;
    if (val && typeof val === 'object') return Object.values(val).some(v => v === 1);
    return false;
}

function getNested(obj, pathArr) {
    return pathArr.reduce((o, k) => (o ? o[k] : undefined), obj);
}

/* 生成单条提示对象，同时保存人类可读文本 */
function buildHint(pathArr, humanText, details, negative) {
    const [type, ...rest] = pathArr;
    // 支持可选的 details 字段（字符串），用于在提示下方补充子词条列表
    const hint = { type, path: rest, text: humanText };
    if (details) hint.details = details;
    if (negative) hint.negative = true;
    return hint;
}

/* ========================== 提示生成 ========================== */
function generateHints(op) {
    const list = [];

    /* 1. 职业：支持同一级别多个词条（如 先锋 与 尖兵），以及可能的分支 */
    if (op.职业) {
        Object.keys(op.职业).forEach(topKey => {
            const val = op.职业[topKey];
            if (typeof val === 'number') {
                if (val === 1) list.push(buildHint(['职业', topKey], `该干员是【${topKey}】干员`));
            } else if (typeof val === 'object') {
                // 若 topKey 下有多个分支，先添加类别提示，再添加每个分支提示
                const anyBranch = Object.values(val).some(v => v === 1);
                if (anyBranch) list.push(buildHint(['职业', topKey], `该干员是【${topKey}】干员`));
                Object.keys(val).forEach(sub => {
                    if (val[sub] === 1) list.push(buildHint(['职业', topKey, sub], `该干员是【${sub}】`));
                });
            }
        });
    }

    /* 3. 特性：先生成类别级提示（详情为 pool 中该类别子词条并集 + 特定前缀），再生成子项提示 */
    if (op.特性) {
        Object.keys(op.特性).forEach(subCat => {
            const subObj = op.特性[subCat];
            if (typeof subObj === 'object') {
                const children = Object.keys(subObj).filter(k => subObj[k] === 1);
                if (children.length > 0) {
                    // 特殊子类：有无异格 与 有无可部署召唤物 —— 只生成子项提示，且提示文本为“该干员【xxx】”
                    if (subCat === '有无异格' || subCat === '有无可部署召唤物') {
                        Object.keys(subObj).forEach(k => {
                            if (subObj[k] === 1) {
                                list.push(buildHint(['特性', subCat, k], `该干员【${k}】`));
                            }
                        });
                        return;
                    }
                    // 特限模组/特勤模组：生成类别级提示与具体特限模组/特勤模组提示
                    if (subCat === '特限模组/特勤模组') {
                        // 类别级提示
                        list.push(buildHint(['特性', subCat], `该干员有【特限模组/特勤模组】`));
                        Object.keys(subObj).forEach(k => {
                            if (subObj[k] === 1) {
                                list.push(buildHint(['特性', subCat, k], `该干员有【${k}】`));
                            }
                        });
                        return;
                    }
                    // 计算在当前候选池（pool）中，该子类别的所有子词条并集；若 pool 为空则回退到 allOperators
                    const source = (Array.isArray(pool) && pool.length) ? pool : allOperators;
                    const unionSet = new Set();
                    source.forEach(p => {
                        const node = getNested(p, ['特性', subCat]);
                        if (node && typeof node === 'object') {
                            Object.keys(node).forEach(k => { if (node[k] === 1) unionSet.add(k); });
                        }
                    });
                    const unionChildren = Array.from(unionSet);
                    // 针对特定子类加入固定说明前缀
                    const prefixMap = {
                        '部署位置': '不包括自身召唤物的部署位置，不考虑部分关卡特殊条件（如干员部署不受远近程限制）。如果在【集成战略】或【生息演算】中，则必须在无关键收藏品或关键道具的情况下。',
                        '伤害类型': '包括本体和自身召唤物造成的伤害。不包括对自身或友方单位的伤害。如果在【集成战略】或【生息演算】中，则必须在无关键收藏品或关键道具的情况下。',
                        '技能类型': '技能类型以技能标注为准，不以实际表现为准。'
                    };
                    const prefix = prefixMap[subCat] || '';
                    const details = (prefix ? prefix + '\n' : '') + `${subCat} 包括 ${unionChildren.map(c => `【${c}】`).join('、')}`;
                    // 特殊处理：限定干员 —— 需要同时生成类别级提示和子项级提示（如夏季限定）
                    if (subCat === '限定干员') {
                        // 类别级提示，详情列出 pool/allOperators 中出现过的限定类型
                        list.push(buildHint(['特性', subCat], `该干员是【${subCat}】`, details));
                        Object.keys(subObj).forEach(k => {
                            if (subObj[k] === 1) {
                                list.push(buildHint(['特性', subCat, k], `该干员是【${k}】`));
                            }
                        });
                    } else {
                        // 对于伤害类型和部署位置，不生成类别级提示（只允许子项提示）；但子项应携带相应 details
                        if (subCat !== '伤害类型' && subCat !== '部署位置' && subCat !== '技能类型') {
                            list.push(buildHint(['特性', subCat], `该干员具有【${subCat}】`, details));
                        }

                        // 子项提示，使用不同引导语；若是伤害类型或部署位置则附带 details（包含前缀说明）
                        Object.keys(subObj).forEach(k => {
                            if (subObj[k] === 1) {
                                const textMap = {
                                    '部署位置': `该干员在普通关卡中能够部署在【${k}】。`,
                                    '伤害类型': `该干员在特定情况下能够对敌方单位造成【${k}】`,
                                    '技能类型': `该干员拥有【${k}】的技能`
                                };
                                const txt = textMap[subCat] || `该干员具有【${k}】特性`;
                                let childDetails = prefix || '';
                                if (subCat === '伤害类型') {
                                    childDetails += (childDetails ? '\n' : '') + '以游戏内文本说明为准，不关注实际代码实现方式';
                                    // 元素伤害/持续伤害 特殊说明
                                    if (k === '元素伤害') {
                                        childDetails += (childDetails ? '\n' : '') + '不包括元素损伤爆发造成的元素伤害';
                                    }
                                    if (k === '持续伤害') {
                                        childDetails += (childDetails ? '\n' : '') + '不包括凋亡损伤爆发造成的持续伤害';
                                    }
                                }
                                list.push(buildHint(['特性', subCat, k], txt, childDetails));
                            }
                        });
                    }
                }
            }
        });
        // 如果该干员没有任何【限定干员】的子词条，则添加负面提示，且在详情中列出 pool/allOperators 中出现过的限定类型
        const limitedNode = op.特性['限定干员'];
        const hasLimited = limitedNode && (limitedNode === 1 || (typeof limitedNode === 'object' && Object.values(limitedNode).some(v => v === 1)));
        if (!hasLimited) {
            // 使用固定说明文本而非动态并集
            const details = '限定干员包括 新春限定、周年/半周年限定、夏季限定、联动限定等';
            list.push(buildHint(['特性', '限定干员'], `该干员【不是限定干员】`, details, true));
        }
        // 特限模组/特勤模组：若无，则加入负面提示“没有特限模组/特勤模组”
        const txNode = op.特性['特限模组/特勤模组'];
        const hasTx = txNode && (txNode === 1 || (typeof txNode === 'object' && Object.values(txNode).some(v => v === 1)));
        if (!hasTx) {
            list.push(buildHint(['特性', '特限模组/特勤模组'], `该干员【没有特限模组/特勤模组】`, undefined, true));
        }
    }

    /* 4. 自身能力：不生成类别级提示，仅为每个子词条生成提示；每个子项的详情包含固定说明+该子类在 pool 中的子词条并集 */
    if (op.自身能力) {
        Object.keys(op.自身能力).forEach(subCat => {
            const subObj = op.自身能力[subCat];
            if (typeof subObj === 'object') {
                const children = Object.keys(subObj).filter(k => subObj[k] === 1);
                if (children.length > 0) {
                    // 计算在当前候选池（pool）中，该子类别的所有子词条并集；若 pool 为空则回退到 allOperators
                    const source = (Array.isArray(pool) && pool.length) ? pool : allOperators;
                    const unionSet = new Set();
                    source.forEach(p => {
                        const node = getNested(p, ['自身能力', subCat]);
                        if (node && typeof node === 'object') {
                            Object.keys(node).forEach(k => { if (node[k] === 1) unionSet.add(k); });
                        }
                    });
                    const unionChildren = Array.from(unionSet);
                    // 固定前缀说明（仅包含自身能力的说明，子项不再附带 subCat 并集）
                    const prefix = '自身能力包括对自身及自身的召唤物的生效的能力。不包括让友方获得的能力或让友方辅助才能获得的能力（如协同攻击）。如果在【集成战略】或【生息演算】中，则必须在无关键收藏品或关键道具的情况下。';
                    const details = prefix;

                    // 为每个子项生成提示，附带仅有的 prefix 说明（不包含 subCat 并集）
                    Object.keys(subObj).forEach(k => {
                        if (subObj[k] === 1) {
                            const textMap = {
                                '伤害类型': `该干员可以造成【${k}】`,
                                '生存能力': `该干员可以【${k}】`,
                                '特殊被选中效果': `该干员拥有【${k}】效果`
                            };
                            const txt = textMap[subCat] || `该干员具有【${k}】`;
                            // 子项说明：对于特定子词条进行替换或追加说明
                            let childDetails;
                            // 如果子词条为『禁疗』，需替换前缀说明（不追加父级的“自身能力包括...”）
                            if (k === '禁疗') {
                                childDetails = '禁疗不包括自身召唤物';
                            } else {
                                childDetails = details || '';
                                if (k === '为自身治疗或生命回复') {
                                    childDetails += (childDetails ? '\n' : '') + '不包括生命上限提升';
                                }
                                // 若为护盾或受伤减免类（含已合并词条），追加元素损伤说明
                                if (k === '为自身提供护盾或屏障' || k === '使自身受伤减免' || k === '庇护自身或使自身受伤减免') {
                                    childDetails += (childDetails ? '\n' : '') + '包括元素损伤';
                                }
                            }
                            list.push(buildHint(['自身能力', subCat, k], txt, childDetails));
                        }
                    });
                }
            }
        });
        // 如果没有任何控制能力，添加负面提示并在详情中列出控制能力类型
        const controlNode = op.辅助能力 && op.辅助能力['控制能力'];
        const hasControl = controlNode && (controlNode === 1 || (typeof controlNode === 'object' && Object.values(controlNode).some(v => v === 1)));
        if (!hasControl) {
            const controlDetails = '控制能力包括 晕眩、位移/传送、沉默、束缚、寒冷/冻结、浮空、战栗、恐惧、麻痹、诱导、沉睡、停顿/降低移动速度';
            list.push(buildHint(['辅助能力', '控制能力'], `该干员【没有控制能力】`, controlDetails, true));
        }
    }

    /* 5. 辅助能力：支持二级提示并列出子词条详情 */
    if (op.辅助能力) {
        Object.keys(op.辅助能力).forEach(subCat => {
            const subObj = op.辅助能力[subCat];
            if (typeof subObj === 'object') {
                const children = Object.keys(subObj).filter(k => subObj[k] === 1);
                if (children.length > 0) {
                    const source = (Array.isArray(pool) && pool.length) ? pool : allOperators;
                    const unionSet = new Set();
                    source.forEach(p => {
                        const node = getNested(p, ['辅助能力', subCat]);
                        if (node && typeof node === 'object') {
                            Object.keys(node).forEach(k => { if (node[k] === 1) unionSet.add(k); });
                        }
                    });
                    const unionChildren = Array.from(unionSet);
                    let details;
                    if (subCat === '控制能力') {
                        // 使用固定说明文本而非动态并集
                        details = '控制能力包括 晕眩、位移/传送、沉默、束缚、寒冷/冻结、浮空、战栗、恐惧、麻痹、诱导、沉睡、停顿/降低移动速度';
                    } else {
                        details = `${subCat} 包括 ${unionChildren.map(c => `【${c}】`).join('、')}`;
                    }
                    // 取消对 保人能力 / 增益能力 / 削弱能力 的类别级提示，仅保留子项提示
                    if (subCat !== '保人能力' && subCat !== '增益能力' && subCat !== '削弱能力') {
                        list.push(buildHint(['辅助能力', subCat], `该干员具有【${subCat}】`, details));
                    }
                    // 如果是控制能力且本干员具有多于一种控制能力，额外提示“不止一种控制能力”（补充说明同控制能力类别）
                    if (subCat === '控制能力' && children.length > 1) {
                        list.push(buildHint(['辅助能力', subCat, '__multiple__'], `该干员具有【不止一种控制能力】`, details));
                    }
                    // 子项提示：附带辅助能力的固定前缀说明（不包含 subCat 并集）
                    const auxPrefix = '辅助能力不包括对自身召唤物的加成，但包括对友方召唤物的加成。如果在【集成战略】或【生息演算】中，则必须在无关键收藏品或关键道具的情况下。';
                    Object.keys(subObj).forEach(k => {
                        if (subObj[k] === 1) {
                            let childDetails = auxPrefix || '';
                            if (k === '使友方基础属性提高或造成伤害提升') {
                                childDetails += (childDetails ? '\n' : '') + '包括攻击力、防御力、生命上限、法术抗性；也包括提升造成伤害的效果，如鼓舞或精力充沛类提升';
                            }
                            if (k === '为友方治疗') {
                                childDetails += (childDetails ? '\n' : '') + '包含且仅包含所有会显示绿字的治疗类型';
                            } else if (k === '使友方生命回复') {
                                childDetails += (childDetails ? '\n' : '') + '包含且仅包含所有不会显示绿字的生命回复效果';
                            }
                            if (k === '影响友方弹药数量') {
                                childDetails += (childDetails ? '\n' : '') + '不包括因其他干员的天赋等而对其造成的影响';
                            }
                            if (k === '使敌方获得脆弱或受伤增加') {
                                childDetails += (childDetails ? '\n' : '') + '不包括仅自身对敌人伤害增加';
                            }
                            // 控制能力中特殊子项说明：麻痹/诱导
                            if (k === '麻痹') {
                                childDetails += (childDetails ? '\n' : '') + '不包括神经损伤爆发造成的麻痹';
                            }
                            if (k === '诱导') {
                                childDetails += (childDetails ? '\n' : '') + '包括除恐惧外改变敌方路径点的效果';
                            }
                            if (k === '降低敌方基础属性') {
                                childDetails += (childDetails ? '\n' : '') + '包括攻击力、防御力、生命上限、法术抗性；不包括由于冻结或元素损伤爆发造成的属性降低；包括虚弱等效果';
                            }
                            // 对于为友方提供护盾/使友方受伤减免类（含合并词条），追加元素损伤说明
                            if (k === '为友方提供护盾或屏障' || k === '使友方受伤减免' || k === '庇护友方或使友方受伤减免') {
                                childDetails += (childDetails ? '\n' : '') + '包括元素损伤';
                            }
                            list.push(buildHint(['辅助能力', subCat, k], `该干员拥有【${k}】能力`, childDetails));
                        }
                    });
                }
            }
        });
    }

    /* 原始评分与排序（保留旧逻辑以确定候选排序） */
    const source = (Array.isArray(pool) && pool.length) ? pool : allOperators;
    const scored = list.map(h => {
        const matches = source.filter(op => matchHint(op, h)).length;
        const excluded = source.length - matches;
        return { hint: h, matches, excluded };
    });
    // 先筛选出能排除至少 3 个干员的提示
    let filtered = scored.filter(s => s.excluded >= 3);
    // 若没有任何提示满足排除 3 个的条件，则回退到全部提示
    if (!filtered.length) filtered = scored;
    // 保持按匹配人数从多到少排序（与原逻辑一致），此排序用于提示优先级的初始序列
    filtered.sort((a, b) => b.matches - a.matches);

    /* 新增顺序约束（在保留原排序的基础上）：
       - 逐条选择提示（上限 10 条），每轮基于当前剩余候选集决定可接受的提示。
       - 若当前剩余人数 >= 3：优先选取能从剩余集中排除 >=3 人的提示；若无则按原排序取首项。
       - 若当前剩余人数 < 3：必须选择能把剩余人数缩减到 1 的提示（matches === 1）；若无则选择能最小化 matches 的提示。
       - 即使已只剩 1 人，也允许继续生成提示，直到达到 10 条或没有更多候选提示。
    */
    const initialOrdered = filtered.map(s => s.hint);
    const available = initialOrdered.slice();
    let remaining = source.slice();
    const selected = [];
    const usedKeys = new Set();

    for (let round = 0; round < 10; round++) {
        if (!available.length) break;

        // 计算每个可选提示相对于当前 remaining 的 matches/excluded
        const scoredCur = available.map(h => {
            const key = JSON.stringify(h);
            if (usedKeys.has(key)) return null;
            const matches = remaining.filter(o => matchHint(o, h)).length;
            const excluded = remaining.length - matches;
            return { h, matches, excluded, key };
        }).filter(Boolean);
        if (!scoredCur.length) break;

        let pick = null;
        if (remaining.length >= 3) {
            // 找一个能排除至少 3 人的提示（相对于当前 remaining）——优先保留原排序顺序
            pick = scoredCur.find(s => s.excluded >= 3) || scoredCur[0];
        } else {
            // 必须将候选缩减到 1 人
            pick = scoredCur.find(s => s.matches === 1);
            if (!pick) {
                // 若没有直接缩减到 1 的提示，则选择能将 matches 最小化的提示
                scoredCur.sort((a, b) => a.matches - b.matches || b.excluded - a.excluded);
                pick = scoredCur[0];
            }
        }

        if (!pick) break;
        // 记录选择并从 available 中移除
        selected.push(pick.h);
        usedKeys.add(pick.key);
        for (let i = available.length - 1; i >= 0; i--) {
            if (JSON.stringify(available[i]) === pick.key) available.splice(i, 1);
        }
        // 更新 remaining
        remaining = remaining.filter(o => matchHint(o, pick.h));
        // 继续下一轮（即便 remaining 已为 1，也允许继续挑选，直到 10 条或提示耗尽）
    }

    return selected;
}

/* ========================== 渲染 ========================== */
function renderGrid() {
    gridEl.innerHTML = '';
    pool.forEach((op, idx) => {
        const card = document.createElement('div');
        card.className = 'operator-card';
        if (excluded.has(idx)) card.classList.add('excluded');
        if (selectedIndex === idx) card.classList.add('selected');
        card.textContent = op.name;
        card.dataset.index = idx;

        /* 左键选中 */
        card.addEventListener('click', () => {
            if (!gameStarted) return;
            document.querySelectorAll('.operator-card').forEach(c => c.classList.remove('selected'));
            selectedIndex = idx;
            card.classList.add('selected');
            submitBtn.disabled = false;
        });

        /* 右键排除 */
        card.addEventListener('contextmenu', e => {
            e.preventDefault();
            if (!gameStarted) return;
            if (excluded.has(idx)) {
                excluded.delete(idx);
                card.classList.remove('excluded');
            } else {
                excluded.add(idx);
                card.classList.add('excluded');
                if (selectedIndex === idx) {
                    selectedIndex = null;
                    submitBtn.disabled = true;
                }
            }
        });

        gridEl.appendChild(card);
    });
}

function renderHint() {
    if (!hints.length) return;
    const h = hints[currentHintIndex];
    hintTextEl.textContent = h.text;
    // 支持换行显示（将 \n 转为 <br>）
    hintDetailsEl.innerHTML = h.details ? h.details.replace(/\n/g, '<br>') : '';
    currentHintEl.textContent = currentHintIndex + 1;
}

function renderAllHintsPanel() {
    if (!allHintsList) return;
    allHintsList.innerHTML = '';
    // 仅显示已公布的提示（到 currentHintIndex 为止），不展示补充说明或匹配计数
    if (!hints || !hints.length || currentHintIndex < 0) {
        allHintsList.textContent = '当前尚无已公布提示';
        return;
    }
    const visible = hints.slice(0, currentHintIndex + 1);
    visible.forEach((h, idx) => {
        const div = document.createElement('div');
        div.className = 'all-hint-item';
        const title = document.createElement('div');
        title.textContent = `${idx + 1}. ${h.text}`;
        div.appendChild(title);
        // 不显示 h.details（补充说明）
        allHintsList.appendChild(div);
    });
}

/* ========================== 游戏流程 ========================== */
function startGame() {
    if (allOperators.length === 0) {
        alert('干员数据尚未加载！');
        return;
    }
    gameStarted = true;
    // 点击“开始游戏”时隐藏“全部已知提示”面板
    if (allHintsPanel) allHintsPanel.style.display = 'none';
    excluded.clear();
    selectedIndex = null;
    hints = [];
    currentHintIndex = 0;
    resultAreaEl.innerHTML = '';

    /* 抽取 32 名 */
    pool = shuffle(allOperators).slice(0, Math.min(32, allOperators.length));
    answer = pickRandom(pool);

    /* 生成提示 */
    hints = generateHints(answer);

    /* UI */
    renderGrid();
    renderHint();
    startBtn.disabled = true;
    nextHintBtn.disabled = false;
    submitBtn.disabled = true;
}

function nextHint() {
    if (currentHintIndex < hints.length - 1) {
        currentHintIndex++;
        renderHint();
    } else {
        nextHintBtn.disabled = true;
    }
    // 用户翻到下一条提示时，自动收起“全部已知提示”面板（需要再次点击才能展开）
    if (allHintsPanel && allHintsPanel.style.display !== 'none') {
        allHintsPanel.style.display = 'none';
    }
}

function submitAnswer() {
    // 点击“提交”时收起“全部已知提示”面板
    if (allHintsPanel) allHintsPanel.style.display = 'none';
    if (selectedIndex === null) return;
    const correct = pool[selectedIndex] === answer;
    totalGames++;
    totalHintsUsed += currentHintIndex + 1;
    if (correct) winGames++;
    if (correct) {
        // 记录答对时使用的提示数（用于平均答对提示数）
        hintsUsedForCorrect += currentHintIndex + 1;
    }

    /* 高亮 */
    document.querySelectorAll('.operator-card').forEach((c, i) => {
        if (pool[i] === answer) c.classList.add('correct');
        else if (i === selectedIndex && !correct) c.classList.add('wrong');
    });

    /* 结果显示 */
    let html = `<h4>${correct ? '✅ 回答正确！' : '❌ 回答错误！'}</h4>`;
    html += `<div>答案：${answer.name}</div>`;
    html += `<div class="candidate-list"><strong>已公布提示：</strong><ul>`;
    for (let i = 0; i <= currentHintIndex; i++) {
        html += `<li>${i + 1}. ${hints[i].text}`;
        // 为该条提示计算满足到此提示为止的候选范围（默认折叠）
        const candidatesUpTo = pool.filter(op => hints.slice(0, i + 1).every(h => matchHint(op, h)));
        html += `<details><summary>满足以上所有提示的干员（${candidatesUpTo.length}）</summary><div class="candidate-names">`;
        candidatesUpTo.forEach(op => { html += `<div>${op.name}</div>`; });
        html += `</div></details>`;
        html += `</li>`;
    }
    html += `</ul></div>`;

    /* 满足全部已公布提示的干员 */
    const candidates = pool.filter(op =>
        hints.slice(0, currentHintIndex + 1).every(h => matchHint(op, h))
    );
    html += `<div class="candidate-list"><strong>满足全部提示的干员：</strong><ul>`;
    candidates.forEach(op => html += `<li>${op.name}</li>`);
    html += `</ul></div>`;

    resultAreaEl.innerHTML = html;

    /* 更新统计 */
    winRateEl.textContent = totalGames ? Math.round((winGames / totalGames) * 100) + '%' : '0%';
    // 平均答对提示数：按答对次数计算
    avgHintsEl.textContent = winGames ? (hintsUsedForCorrect / winGames).toFixed(1) : '0';

    /* 按钮状态 */
    gameStarted = false;
    startBtn.disabled = false;
    nextHintBtn.disabled = true;
    submitBtn.disabled = true;

    // 保存到 Supabase（若已初始化）
    try {
        const saveFn = window.saveGameHistory;
        if (typeof saveFn === 'function') {
            const userId = window.authManager?.currentUser?.id || null;
            const stats = {
                attempts: totalGames,
                correct_count: winGames,
                accuracy: totalGames ? (winGames / totalGames) : 0,
                avg_hints_correct: winGames ? (hintsUsedForCorrect / winGames) : 0
            };
            // 不等待结果：异步保存，不阻塞 UI
            saveFn(userId, stats).then(res => {
                if (res && res.error) console.error('保存游戏历史返回错误', res.error);
            }).catch(err => console.error('保存游戏历史异常', err));
        }
    } catch (e) {
        console.error('尝试保存游戏历史时发生错误', e);
    }
}

/* ========================== 绑定事件 ========================== */
startBtn.addEventListener('click', startGame);
nextHintBtn.addEventListener('click', nextHint);
submitBtn.addEventListener('click', submitAnswer);
if (showAllHintsBtn) showAllHintsBtn.addEventListener('click', () => {
    if (!allHintsPanel) return;
    const shown = allHintsPanel.style.display !== 'none';
    allHintsPanel.style.display = shown ? 'none' : 'block';
    if (!shown) renderAllHintsPanel();
});

/* ========================== 入口 ========================== */
window.addEventListener('DOMContentLoaded', () => {
    loadOperators();
});