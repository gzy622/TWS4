(function() {
    window.TWS3 = window.TWS3 || {};

    const BASE_TIME = "2026-08-28T08:00:00.000Z";

    // 班级 1：高二 (3) 班学生花名册 (50人)
    const INITIAL_STUDENT_NAMES = [
        "林澈", "何予安", "罗知夏", "周宁", "谢明澈",
        "邵清禾", "许禾", "钟以宁", "余景然", "沈川",
        "杜星遥", "袁书言", "唐安", "孟舒然", "白念初",
        "苏遥", "魏予晴", "夏嘉树", "陆晴", "彭知远",
        "侯若溪", "程野", "冯安禾", "郑沐川", "叶舟",
        "曹景行", "方云舟", "江言", "邹可昕", "熊清越",
        "宋禾", "姜思齐", "尹星野", "梁溪", "蒋书宁",
        "贺若安", "韩越", "田南乔", "任知微", "秦朗",
        "范语川", "汪嘉禾", "乔宁", "康念安", "潘清扬",
        "廖予墨", "金明希", "石以南", "赖云舒", "毛安澄"
    ];

    // 学号 5、18、32、45 设为非英语生（日语/俄语），用于展示多语种豁免特性
    const NON_ENGLISH_IDS_CLASS_1 = new Set([5, 18, 32, 45]);

    const INITIAL_STUDENTS = INITIAL_STUDENT_NAMES.map((name, index) => {
        const id = index + 1;
        return {
            id: id,
            studentNo: String(id),
            name: name,
            isNonEnglish: NON_ENGLISH_IDS_CLASS_1.has(id),
            updatedAt: BASE_TIME
        };
    });

    // 多维度作业集（包含进行中与已归档、不同科目与模式）
    const INITIAL_TASKS = [
        {
            id: "task_0828_yw",
            name: "0828 语文《赤壁赋》背诵默写",
            subject: "语文",
            archived: false,
            createdAt: "2026-08-28T08:00:00.000Z",
            updatedAt: "2026-08-28T08:00:00.000Z"
        },
        {
            id: "task_0828_sx",
            name: "0828 数学导数与切线综合练习",
            subject: "数学",
            archived: false,
            createdAt: "2026-08-28T07:30:00.000Z",
            updatedAt: "2026-08-28T07:30:00.000Z"
        },
        {
            id: "task_0828_yy",
            name: "0828 英语Unit3核心词汇背诵",
            subject: "英语",
            archived: false,
            createdAt: "2026-08-28T07:00:00.000Z",
            updatedAt: "2026-08-28T07:00:00.000Z"
        },
        {
            id: "task_0827_wl",
            name: "0827 物理电磁感应大题专练",
            subject: "物理",
            archived: false,
            createdAt: "2026-08-27T08:00:00.000Z",
            updatedAt: "2026-08-27T08:00:00.000Z"
        },
        {
            id: "task_0825_hx",
            name: "0825 化学有机推断综合周练",
            subject: "化学",
            archived: true,
            createdAt: "2026-08-25T08:00:00.000Z",
            updatedAt: "2026-08-25T08:00:00.000Z"
        },
        {
            id: "task_0822_sw",
            name: "0822 生物伴性遗传考点测验",
            subject: "生物",
            archived: true,
            createdAt: "2026-08-22T08:00:00.000Z",
            updatedAt: "2026-08-22T08:00:00.000Z"
        },
        {
            id: "task_0818_ls",
            name: "0818 历史近代史主观题巩固",
            subject: "历史",
            archived: true,
            createdAt: "2026-08-18T08:00:00.000Z",
            updatedAt: "2026-08-18T08:00:00.000Z"
        }
    ];

    // 作业 1（语文默写）详细提交记录
    const RAW_YW_RECORDS = {
        1: { status: "dark", badge: "全对", score: 100, note: "字迹工整" },
        2: { status: "dark", badge: "优", score: 98, note: null },
        3: { status: "dark", badge: null, score: 95, note: null },
        4: { status: "white", badge: "请假", score: null, note: "病假" },
        5: { status: "dark", badge: null, score: 92, note: null },
        6: { status: "dark", badge: "全对", score: 100, note: null },
        7: { status: "muted", badge: "订正中", score: 78, note: "第3段错别字" },
        8: { status: "dark", badge: null, score: 90, note: null },
        9: { status: "dark", badge: null, score: 96, note: null },
        10: { status: "dark", badge: "补交", score: 88, note: "已补交" },
        11: { status: "dark", badge: null, score: 94, note: null },
        12: { status: "muted", badge: "订正中", score: 82, note: "尾句漏字" },
        13: { status: "dark", badge: null, score: 95, note: null },
        14: { status: "dark", badge: null, score: 91, note: null },
        15: { status: "dark", badge: "优+", score: 100, note: "优秀" },
        16: { status: "dark", badge: null, score: 96, note: null },
        17: { status: "dark", badge: null, score: 93, note: null },
        18: { status: "dark", badge: "迟交", score: 85, note: "迟交10分钟" },
        19: { status: "dark", badge: null, score: 97, note: null },
        20: { status: "dark", badge: null, score: 92, note: null },
        21: { status: "white", badge: "未交", score: null, note: null },
        22: { status: "dark", badge: null, score: 90, note: null },
        23: { status: "dark", badge: null, score: 94, note: null },
        24: { status: "dark", badge: null, score: 95, note: null },
        25: { status: "dark", badge: "全对", score: 100, note: null },
        26: { status: "dark", badge: null, score: 89, note: null },
        27: { status: "dark", badge: null, score: 93, note: null },
        28: { status: "dark", badge: null, score: 91, note: null },
        29: { status: "muted", badge: "订正中", score: 75, note: "错2处通假字" },
        30: { status: "dark", badge: null, score: 96, note: null },
        31: { status: "dark", badge: null, score: 94, note: null },
        32: { status: "dark", badge: null, score: 92, note: null },
        33: { status: "dark", badge: null, score: 98, note: null },
        34: { status: "dark", badge: null, score: 95, note: null },
        35: { status: "white", badge: "未交", score: null, note: null },
        36: { status: "dark", badge: null, score: 91, note: null },
        37: { status: "muted", badge: "订正中", score: 80, note: "重默第一段" },
        38: { status: "dark", badge: null, score: 96, note: null },
        39: { status: "dark", badge: null, score: 93, note: null },
        40: { status: "dark", badge: null, score: 97, note: null },
        41: { status: "dark", badge: null, score: 95, note: null },
        42: { status: "dark", badge: null, score: 90, note: null },
        43: { status: "dark", badge: null, score: 92, note: null },
        44: { status: "dark", badge: null, score: 94, note: null },
        45: { status: "dark", badge: null, score: 88, note: null },
        46: { status: "dark", badge: "优", score: 99, note: null },
        47: { status: "dark", badge: null, score: 91, note: null },
        48: { status: "dark", badge: null, score: 93, note: null },
        49: { status: "dark", badge: null, score: 96, note: null },
        50: { status: "dark", badge: null, score: 95, note: null }
    };

    // 作业 2（数学练习）详细打分记录
    const RAW_SX_RECORDS = {
        1: { status: "dark", badge: "100", score: 100, note: null },
        2: { status: "dark", badge: "96", score: 96, note: "-4 倒数第二步失误" },
        3: { status: "dark", badge: "92", score: 92, note: "-8 漏分类讨论" },
        4: { status: "dark", badge: "88", score: 88, note: null },
        5: { status: "dark", badge: "95", score: 95, note: null },
        6: { status: "dark", badge: "100", score: 100, note: "解法巧妙" },
        7: { status: "dark", badge: "76", score: 76, note: "-24 选填错2题" },
        8: { status: "dark", badge: "90", score: 90, note: null },
        9: { status: "dark", badge: "94", score: 94, note: null },
        10: { status: "white", badge: "未交", score: null, note: null },
        11: { status: "dark", badge: "91", score: 91, note: null },
        12: { status: "dark", badge: "85", score: 85, note: "-15 步骤欠规范" },
        13: { status: "dark", badge: "98", score: 98, note: null },
        14: { status: "dark", badge: "89", score: 89, note: null },
        15: { status: "dark", badge: "100", score: 100, note: null },
        16: { status: "dark", badge: "97", score: 97, note: null },
        17: { status: "dark", badge: "93", score: 93, note: null },
        18: { status: "dark", badge: "82", score: 82, note: "-18 计算粗心" },
        19: { status: "dark", badge: "99", score: 99, note: null },
        20: { status: "dark", badge: "90", score: 90, note: null },
        21: { status: "dark", badge: "86", score: 86, note: null },
        22: { status: "dark", badge: "92", score: 92, note: null },
        23: { status: "dark", badge: "94", score: 94, note: null },
        24: { status: "dark", badge: "95", score: 95, note: null },
        25: { status: "dark", badge: "100", score: 100, note: null },
        26: { status: "dark", badge: "87", score: 87, note: null },
        27: { status: "white", badge: "未交", score: null, note: null },
        28: { status: "dark", badge: "91", score: 91, note: null },
        29: { status: "muted", badge: "68", score: 68, note: "需面批第21题" },
        30: { status: "dark", badge: "96", score: 96, note: null },
        31: { status: "dark", badge: "93", score: 93, note: null },
        32: { status: "dark", badge: "89", score: 89, note: null },
        33: { status: "dark", badge: "97", score: 97, note: null },
        34: { status: "dark", badge: "94", score: 94, note: null },
        35: { status: "dark", badge: "85", score: 85, note: null },
        36: { status: "dark", badge: "90", score: 90, note: null },
        37: { status: "dark", badge: "78", score: 78, note: "-22 第20题未作答" },
        38: { status: "dark", badge: "96", score: 96, note: null },
        39: { status: "dark", badge: "92", score: 92, note: null },
        40: { status: "dark", badge: "98", score: 98, note: null },
        41: { status: "dark", badge: "95", score: 95, note: null },
        42: { status: "dark", badge: "88", score: 88, note: null },
        43: { status: "dark", badge: "91", score: 91, note: null },
        44: { status: "dark", badge: "93", score: 93, note: null },
        45: { status: "dark", badge: "86", score: 86, note: null },
        46: { status: "dark", badge: "100", score: 100, note: null },
        47: { status: "dark", badge: "90", score: 90, note: null },
        48: { status: "dark", badge: "92", score: 92, note: null },
        49: { status: "dark", badge: "97", score: 97, note: null },
        50: { status: "dark", badge: "95", score: 95, note: null }
    };

    // 构建完整初始记录
    const INITIAL_RECORDS = {
        "task_0828_yw": {},
        "task_0828_sx": {},
        "task_0828_yy": {},
        "task_0827_wl": {},
        "task_0825_hx": {},
        "task_0822_sw": {},
        "task_0818_ls": {}
    };

    for (let i = 1; i <= 50; i++) {
        // 语文
        const rawYw = RAW_YW_RECORDS[i] || { status: "dark", badge: null, score: 90, note: null };
        INITIAL_RECORDS["task_0828_yw"][i] = {
            status: rawYw.status,
            badge: rawYw.badge,
            score: rawYw.score,
            note: rawYw.note,
            updatedAt: BASE_TIME
        };

        // 数学
        const rawSx = RAW_SX_RECORDS[i] || { status: "dark", badge: "90", score: 90, note: null };
        INITIAL_RECORDS["task_0828_sx"][i] = {
            status: rawSx.status,
            badge: rawSx.badge,
            score: rawSx.score,
            note: rawSx.note,
            updatedAt: BASE_TIME
        };

        // 英语（非英语生自动豁免）
        if (NON_ENGLISH_IDS_CLASS_1.has(i)) {
            INITIAL_RECORDS["task_0828_yy"][i] = {
                status: "muted",
                badge: "非英语",
                score: null,
                note: "日语生豁免",
                updatedAt: BASE_TIME
            };
        } else {
            const isDone = i % 7 !== 0;
            INITIAL_RECORDS["task_0828_yy"][i] = {
                status: isDone ? "dark" : "white",
                badge: isDone ? null : "未交",
                score: isDone ? (90 + (i % 11)) : null,
                note: null,
                updatedAt: BASE_TIME
            };
        }

        // 物理
        const isWlDone = i % 9 !== 0;
        INITIAL_RECORDS["task_0827_wl"][i] = {
            status: isWlDone ? "dark" : (i === 9 ? "muted" : "white"),
            badge: isWlDone ? null : (i === 9 ? "订正" : null),
            score: isWlDone ? (85 + (i % 16)) : null,
            note: i === 9 ? "待订正第2问" : null,
            updatedAt: BASE_TIME
        };

        // 化学 (已归档)
        INITIAL_RECORDS["task_0825_hx"][i] = {
            status: i === 13 ? "white" : "dark",
            badge: i === 13 ? "缺卡" : "完成",
            score: 88 + (i % 13),
            note: null,
            updatedAt: BASE_TIME
        };

        // 生物 (已归档)
        INITIAL_RECORDS["task_0822_sw"][i] = {
            status: "dark",
            badge: null,
            score: 90 + (i % 11),
            note: null,
            updatedAt: BASE_TIME
        };

        // 历史 (已归档)
        INITIAL_RECORDS["task_0818_ls"][i] = {
            status: i % 12 === 0 ? "white" : "dark",
            badge: null,
            score: 86 + (i % 14),
            note: null,
            updatedAt: BASE_TIME
        };
    }

    // 班级 2：高二 (4) 班数据
    const INITIAL_CLASS_2_NAME = "高二 (4) 班";
    const INITIAL_STUDENT_NAMES_CLASS_2 = [
        "安晨", "白宇", "陈思源", "程锦", "崔皓",
        "邓嘉敏", "杜若", "方博", "高睿", "顾远",
        "韩雨彤", "郝天宇", "何佳欣", "洪涛", "胡梦琪",
        "黄子轩", "贾楠", "江北", "姜逸飞", "蒋欣然",
        "金羽", "雷鸣", "李知微", "梁子恒", "林安",
        "刘星宇", "陆言", "罗凯", "马小雅", "毛宇轩",
        "孟泽", "潘逸晨", "彭飞", "钱程", "邱悦",
        "任嘉浩", "沈清越", "宋歌", "苏文", "孙晓",
        "唐心怡", "田畅", "童心", "汪涵", "王楚",
        "魏铭", "吴优", "肖凡", "谢天", "徐诺"
    ];

    const NON_ENGLISH_IDS_CLASS_2 = new Set([8, 23, 41]);

    const INITIAL_STUDENTS_CLASS_2 = INITIAL_STUDENT_NAMES_CLASS_2.map((name, index) => {
        const id = index + 1;
        return {
            id: id,
            studentNo: String(id),
            name: name,
            isNonEnglish: NON_ENGLISH_IDS_CLASS_2.has(id),
            updatedAt: BASE_TIME
        };
    });

    const INITIAL_TASKS_CLASS_2 = [
        { id: "task_c2_0828", name: "0828 语文基础字词默写", subject: "语文", archived: false, createdAt: "2026-08-28T08:00:00.000Z", updatedAt: "2026-08-28T08:00:00.000Z" },
        { id: "task_c2_0827", name: "0827 英语课后阅读练习", subject: "英语", archived: false, createdAt: "2026-08-27T08:00:00.000Z", updatedAt: "2026-08-27T08:00:00.000Z" },
        { id: "task_c2_0824", name: "0824 数学立体几何作图", subject: "数学", archived: true, createdAt: "2026-08-24T08:00:00.000Z", updatedAt: "2026-08-24T08:00:00.000Z" }
    ];

    const INITIAL_RECORDS_CLASS_2 = {
        "task_c2_0828": {},
        "task_c2_0827": {},
        "task_c2_0824": {}
    };

    for (let i = 1; i <= 50; i++) {
        INITIAL_RECORDS_CLASS_2["task_c2_0828"][i] = {
            status: i % 5 === 0 ? "white" : "dark",
            badge: i % 5 === 0 ? "未交" : (i % 8 === 0 ? "订正" : null),
            score: i % 5 === 0 ? null : (88 + (i % 13)),
            note: null,
            updatedAt: BASE_TIME
        };
        INITIAL_RECORDS_CLASS_2["task_c2_0827"][i] = {
            status: NON_ENGLISH_IDS_CLASS_2.has(i) ? "muted" : (i % 6 === 0 ? "white" : "dark"),
            badge: NON_ENGLISH_IDS_CLASS_2.has(i) ? "非英语" : null,
            score: NON_ENGLISH_IDS_CLASS_2.has(i) ? null : 90,
            note: null,
            updatedAt: BASE_TIME
        };
        INITIAL_RECORDS_CLASS_2["task_c2_0824"][i] = {
            status: "dark",
            badge: null,
            score: 95,
            note: null,
            updatedAt: BASE_TIME
        };
    }

    const INITIAL_CLASS_NAME = "高二 (3) 班";
    const INITIAL_SCHEDULE_TEMPLATE_VERSION = 3;

    const LEGACY_SCHEDULE_TEMPLATE = {
        days: [
            { id: "day_1", name: "星期一", order: 1 },
            { id: "day_2", name: "星期二", order: 2 },
            { id: "day_3", name: "星期三", order: 3 },
            { id: "day_4", name: "星期四", order: 4 },
            { id: "day_5", name: "星期五", order: 5 }
        ],
        periods: [
            { id: "p_1", name: "1", order: 1 },
            { id: "p_2", name: "2", order: 2 },
            { id: "p_3", name: "3", order: 3 },
            { id: "p_4", name: "4", order: 4 },
            { id: "p_5", name: "5", order: 5 },
            { id: "p_6", name: "6", order: 6 },
            { id: "p_7", name: "7", order: 7 }
        ],
        courseLibrary: [
            { id: "c_yy", name: "英语", color: "english" },
            { id: "c_yw", name: "语文", color: "default" },
            { id: "c_sx", name: "数学", color: "default" },
            { id: "c_ls", name: "历史", color: "default" },
            { id: "c_ty", name: "通用", color: "default" },
            { id: "c_zz", name: "政治", color: "default" },
            { id: "c_ms", name: "美术", color: "default" },
            { id: "c_sw", name: "生物", color: "default" },
            { id: "c_bh", name: "班会", color: "default" },
            { id: "c_wh", name: "物合", color: "default" },
            { id: "c_xx", name: "信息", color: "default" },
            { id: "c_pe", name: "体育", color: "default" },
            { id: "c_mu", name: "音乐", color: "default" },
            { id: "c_dh", name: "地合", color: "default" },
            { id: "c_hh", name: "化合", color: "default" },
            { id: "c_wl", name: "物理", color: "default" },
            { id: "c_hx", name: "化学", color: "default" },
            { id: "c_dl", name: "地理", color: "default" }
        ],
        grid: {
            "day_1_p_1": { courseId: "c_yy", customName: "" },
            "day_1_p_2": { courseId: "c_sx", customName: "" },
            "day_1_p_3": { courseId: "c_ty", customName: "" },
            "day_1_p_4": { courseId: "c_zz", customName: "" },
            "day_1_p_5": { courseId: "c_ms", customName: "" },
            "day_1_p_6": { courseId: "c_sw", customName: "" },
            "day_1_p_7": { courseId: "c_bh", customName: "" },
            "day_2_p_1": { courseId: "c_yw", customName: "" },
            "day_2_p_2": { courseId: "c_ls", customName: "" },
            "day_2_p_3": { courseId: "c_sx", customName: "" },
            "day_2_p_4": { courseId: "c_yy", customName: "" },
            "day_2_p_5": { courseId: "c_wh", customName: "" },
            "day_2_p_6": { courseId: "c_xx", customName: "" },
            "day_2_p_7": { courseId: "c_pe", customName: "" },
            "day_3_p_1": { courseId: "c_yy", customName: "" },
            "day_3_p_2": { courseId: "c_ls", customName: "" },
            "day_3_p_3": { courseId: "c_yw", customName: "" },
            "day_3_p_4": { courseId: "c_sx", customName: "" },
            "day_3_p_5": { courseId: "c_mu", customName: "" },
            "day_3_p_6": { courseId: "c_dh", customName: "" },
            "day_3_p_7": { courseId: "c_zz", customName: "" },
            "day_4_p_1": { courseId: "c_yw", customName: "" },
            "day_4_p_2": { courseId: "c_yw", customName: "" },
            "day_4_p_3": { courseId: "c_ls", customName: "" },
            "day_4_p_4": { courseId: "c_sw", customName: "" },
            "day_4_p_5": { courseId: "c_yy", customName: "" },
            "day_4_p_6": { courseId: "c_sx", customName: "" },
            "day_5_p_1": { courseId: "c_yy", customName: "" },
            "day_5_p_2": { courseId: "c_sx", customName: "" },
            "day_5_p_3": { courseId: "c_sw", customName: "" },
            "day_5_p_4": { courseId: "c_yw", customName: "" },
            "day_5_p_5": { courseId: "c_hh", customName: "" },
            "day_5_p_6": { courseId: "c_zz", customName: "" },
            "day_5_p_7": { courseId: "c_pe", customName: "" }
        }
    };

    const INITIAL_SCHEDULE_DAYS = [
        { id: "day_1", name: "周一", order: 1 },
        { id: "day_2", name: "周二", order: 2 },
        { id: "day_3", name: "周三", order: 3 },
        { id: "day_4", name: "周四", order: 4 },
        { id: "day_5", name: "周五", order: 5 }
    ];

    const DEFAULT_PERIOD_TIMES = {
        'p_morning': '07:40 - 08:00',
        'morning': '07:40 - 08:00',
        '早': '07:40 - 08:00',
        '早读': '07:40 - 08:00',
        'p_1': '08:00 - 08:45',
        '1': '08:00 - 08:45',
        'p_2': '08:55 - 09:40',
        '2': '08:55 - 09:40',
        'p_3': '10:10 - 10:55',
        '3': '10:10 - 10:55',
        'p_4': '11:05 - 11:50',
        '4': '11:05 - 11:50',
        'p_noon': '14:00 - 14:25',
        'noon': '14:00 - 14:25',
        '午': '14:00 - 14:25',
        '午测': '14:00 - 14:25',
        'p_5': '14:30 - 15:15',
        '5': '14:30 - 15:15',
        'p_6': '15:25 - 16:10',
        '6': '15:25 - 16:10',
        'p_7': '16:20 - 17:05',
        '7': '16:20 - 17:05',
        'p_afterschool': '17:20 - 18:05',
        'afterschool': '17:20 - 18:05',
        '后': '17:20 - 18:05',
        '课后': '17:20 - 18:05'
    };

    const INITIAL_SCHEDULE_PERIODS = [
        { id: "p_morning", name: "早", label: "早读", shortLabel: "早", type: "morning", time: "07:40 - 08:00", order: 0 },
        { id: "p_1", name: "1", label: "第1节", shortLabel: "1", type: "regular", time: "08:00 - 08:45", order: 1 },
        { id: "p_2", name: "2", label: "第2节", shortLabel: "2", type: "regular", time: "08:55 - 09:40", order: 2 },
        { id: "p_3", name: "3", label: "第3节", shortLabel: "3", type: "regular", time: "10:10 - 10:55", order: 3 },
        { id: "p_4", name: "4", label: "第4节", shortLabel: "4", type: "regular", time: "11:05 - 11:50", order: 4 },
        { id: "p_noon", name: "午", label: "午测", shortLabel: "午", type: "noon", time: "14:00 - 14:25", order: 4.5 },
        { id: "p_5", name: "5", label: "第5节", shortLabel: "5", type: "regular", time: "14:30 - 15:15", order: 5 },
        { id: "p_6", name: "6", label: "第6节", shortLabel: "6", type: "regular", time: "15:25 - 16:10", order: 6 },
        { id: "p_7", name: "7", label: "第7节", shortLabel: "7", type: "regular", time: "16:20 - 17:05", order: 7 },
        { id: "p_afterschool", name: "后", label: "课后", shortLabel: "后", type: "afterschool", time: "17:20 - 18:05", order: 8 }
    ];

    const INITIAL_COURSE_LIBRARY = [
        { id: "c_yw", name: "语文", color: "chinese", char: "语" },
        { id: "c_sx", name: "数学", color: "math", char: "数" },
        { id: "c_yy", name: "英语", color: "english", char: "英" },
        { id: "c_wl", name: "物理", color: "physics", char: "物" },
        { id: "c_hx", name: "化学", color: "chemistry", char: "化" },
        { id: "c_sw", name: "生物", color: "biology", char: "生" },
        { id: "c_zz", name: "政治", color: "politics", char: "政" },
        { id: "c_ls", name: "历史", color: "history", char: "历" },
        { id: "c_dl", name: "地理", color: "geography", char: "地" },
        { id: "c_pe", name: "体育", color: "pe", char: "体" },
        { id: "c_mu", name: "音乐", color: "music", char: "音" },
        { id: "c_ms", name: "美术", color: "art", char: "美" },
        { id: "c_xx", name: "信息", color: "tech", char: "信" },
        { id: "c_ty", name: "通用", color: "tech", char: "通" },
        { id: "c_bh", name: "班会", color: "class", char: "班" }
    ];

    // 3班课程数据（班主任：邹利珊，来源：2026-2027学年第一学期初二课程表）
    const CLASS_3_GRID = {
        // 周一
        "day_1_p_morning": { courseId: "c_yy", name: "英", fullName: "英语", color: "english", char: "英" },
        "day_1_p_1": { courseId: "c_yw", name: "语", fullName: "语文", color: "chinese", char: "语" },
        "day_1_p_2": { courseId: "c_sx", name: "数", fullName: "数学", color: "math", char: "数" },
        "day_1_p_3": { courseId: "c_yy", name: "英", fullName: "英语", color: "english", char: "英" },
        "day_1_p_4": { courseId: "c_xx", name: "信", fullName: "信息技术", color: "tech", char: "信" },
        "day_1_p_noon": { courseId: "c_sx", name: "数", fullName: "数学", color: "math", char: "数" },
        "day_1_p_5": { courseId: "c_sw", name: "生", fullName: "生物", color: "biology", char: "生" },
        "day_1_p_6": { courseId: "c_mu", name: "音", fullName: "音乐", color: "music", char: "音" },
        "day_1_p_7": { courseId: "c_bh", name: "班", fullName: "班会", color: "class", char: "班" },

        // 周二
        "day_2_p_morning": { courseId: "c_yw", name: "语", fullName: "语文", color: "chinese", char: "语" },
        "day_2_p_1": { courseId: "c_yy", name: "英", fullName: "英语", color: "english", char: "英" },
        "day_2_p_2": { courseId: "c_sx", name: "数", fullName: "数学", color: "math", char: "数" },
        "day_2_p_3": { courseId: "c_zz", name: "政", fullName: "道法/政治", color: "politics", char: "政" },
        "day_2_p_4": { courseId: "c_dl", name: "地", fullName: "地理", color: "geography", char: "地" },
        "day_2_p_noon": { courseId: "c_yy", name: "英", fullName: "英语", color: "english", char: "英" },
        "day_2_p_5": { courseId: "c_ls", name: "历", fullName: "历史", color: "history", char: "历" },
        "day_2_p_6": { courseId: "c_yw", name: "语", fullName: "语文", color: "chinese", char: "语" },
        "day_2_p_7": { courseId: "c_pe", name: "体", fullName: "体育", color: "pe", char: "体" },

        // 周三
        "day_3_p_morning": { courseId: "c_yy", name: "英", fullName: "英语", color: "english", char: "英" },
        "day_3_p_1": { courseId: "c_yy", name: "英", fullName: "英语", color: "english", char: "英" },
        "day_3_p_2": { courseId: "c_yw", name: "语", fullName: "语文", color: "chinese", char: "语" },
        "day_3_p_3": { courseId: "c_wl", name: "物", fullName: "物理", color: "physics", char: "物" },
        "day_3_p_4": { courseId: "c_pe", name: "体", fullName: "体育", color: "pe", char: "体" },
        "day_3_p_noon": { courseId: "c_wl", name: "物", fullName: "物理", color: "physics", char: "物" },
        "day_3_p_5": { courseId: "c_dl", name: "地", fullName: "地理", color: "geography", char: "地" },
        "day_3_p_6": { courseId: "c_ms", name: "美", fullName: "美术/心理", color: "art", char: "美" },
        "day_3_p_7": { courseId: "c_sx", name: "数", fullName: "数学", color: "math", char: "数" },

        // 周四
        "day_4_p_morning": { courseId: "c_yw", name: "语", fullName: "语文", color: "chinese", char: "语" },
        "day_4_p_1": { courseId: "c_yw", name: "语", fullName: "语文", color: "chinese", char: "语" },
        "day_4_p_2": { courseId: "c_sx", name: "数", fullName: "数学", color: "math", char: "数" },
        "day_4_p_3": { courseId: "c_zz", name: "政", fullName: "道法/政治", color: "politics", char: "政" },
        "day_4_p_4": { courseId: "c_sw", name: "生", fullName: "生物", color: "biology", char: "生" },
        "day_4_p_noon": { courseId: "c_yw", name: "语", fullName: "语文", color: "chinese", char: "语" },
        "day_4_p_5": { courseId: "c_yy", name: "英", fullName: "英语", color: "english", char: "英" },
        "day_4_p_6": { courseId: "c_ls", name: "历", fullName: "历史", color: "history", char: "历" },
        "day_4_p_7": { courseId: "c_ty", name: "通", fullName: "通用技术", color: "tech", char: "通" },

        // 周五
        "day_5_p_morning": { courseId: "c_yy", name: "英", fullName: "英语", color: "english", char: "英" },
        "day_5_p_1": { courseId: "c_yw", name: "语", fullName: "语文", color: "chinese", char: "语" },
        "day_5_p_2": { courseId: "c_yy", name: "英", fullName: "英语", color: "english", char: "英" },
        "day_5_p_3": { courseId: "c_sw", name: "生", fullName: "生物", color: "biology", char: "生" },
        "day_5_p_4": { courseId: "c_sx", name: "数", fullName: "数学", color: "math", char: "数" },
        "day_5_p_noon": { courseId: "c_sx", name: "数", fullName: "数学", color: "math", char: "数" },
        "day_5_p_5": { courseId: "c_wl", name: "物", fullName: "物理", color: "physics", char: "物" },
        "day_5_p_6": { courseId: "c_dl", name: "地", fullName: "地理", color: "geography", char: "地" },
        "day_5_p_7": { courseId: "c_pe", name: "体", fullName: "体育", color: "pe", char: "体" }
    };

    // 4班课程数据（班主任：蓝康鑫，来源：2026-2027学年第一学期初二课程表）
    const CLASS_4_GRID = {
        // 周一
        "day_1_p_morning": { courseId: "c_yy", name: "英", fullName: "英语", color: "english", char: "英" },
        "day_1_p_1": { courseId: "c_sx", name: "数", fullName: "数学", color: "math", char: "数" },
        "day_1_p_2": { courseId: "c_yw", name: "语", fullName: "语文", color: "chinese", char: "语" },
        "day_1_p_3": { courseId: "c_wl", name: "物", fullName: "物理", color: "physics", char: "物" },
        "day_1_p_4": { courseId: "c_yy", name: "英", fullName: "英语", color: "english", char: "英" },
        "day_1_p_noon": { courseId: "c_yw", name: "语", fullName: "语文", color: "chinese", char: "语" },
        "day_1_p_5": { courseId: "c_mu", name: "音", fullName: "音乐", color: "music", char: "音" },
        "day_1_p_6": { courseId: "c_zz", name: "政", fullName: "道法/政治", color: "politics", char: "政" },
        "day_1_p_7": { courseId: "c_bh", name: "班", fullName: "班会", color: "class", char: "班" },

        // 周二
        "day_2_p_morning": { courseId: "c_yw", name: "语", fullName: "语文", color: "chinese", char: "语" },
        "day_2_p_1": { courseId: "c_sx", name: "数", fullName: "数学", color: "math", char: "数" },
        "day_2_p_2": { courseId: "c_yy", name: "英", fullName: "英语", color: "english", char: "英" },
        "day_2_p_3": { courseId: "c_pe", name: "体", fullName: "体育", color: "pe", char: "体" },
        "day_2_p_4": { courseId: "c_dl", name: "地", fullName: "地理", color: "geography", char: "地" },
        "day_2_p_noon": { courseId: "c_sx", name: "数", fullName: "数学", color: "math", char: "数" },
        "day_2_p_5": { courseId: "c_sw", name: "生", fullName: "生物", color: "biology", char: "生" },
        "day_2_p_6": { courseId: "c_ls", name: "历", fullName: "历史", color: "history", char: "历" },
        "day_2_p_7": { courseId: "c_yw", name: "语", fullName: "语文", color: "chinese", char: "语" },

        // 周三
        "day_3_p_morning": { courseId: "c_yy", name: "英", fullName: "英语", color: "english", char: "英" },
        "day_3_p_1": { courseId: "c_yw", name: "语", fullName: "语文", color: "chinese", char: "语" },
        "day_3_p_2": { courseId: "c_yy", name: "英", fullName: "英语", color: "english", char: "英" },
        "day_3_p_3": { courseId: "c_xx", name: "信", fullName: "信息技术", color: "tech", char: "信" },
        "day_3_p_4": { courseId: "c_sw", name: "生", fullName: "生物", color: "biology", char: "生" },
        "day_3_p_noon": { courseId: "c_wl", name: "物", fullName: "物理", color: "physics", char: "物" },
        "day_3_p_5": { courseId: "c_sx", name: "数", fullName: "数学", color: "math", char: "数" },
        "day_3_p_6": { courseId: "c_pe", name: "体", fullName: "体育", color: "pe", char: "体" },
        "day_3_p_7": { courseId: "c_dl", name: "地", fullName: "地理", color: "geography", char: "地" },

        // 周四
        "day_4_p_morning": { courseId: "c_yw", name: "语", fullName: "语文", color: "chinese", char: "语" },
        "day_4_p_1": { courseId: "c_sx", name: "数", fullName: "数学", color: "math", char: "数" },
        "day_4_p_2": { courseId: "c_zz", name: "政", fullName: "道法/政治", color: "politics", char: "政" },
        "day_4_p_3": { courseId: "c_yw", name: "语", fullName: "语文", color: "chinese", char: "语" },
        "day_4_p_4": { courseId: "c_wl", name: "物", fullName: "物理", color: "physics", char: "物" },
        "day_4_p_noon": { courseId: "c_yy", name: "英", fullName: "英语", color: "english", char: "英" },
        "day_4_p_5": { courseId: "c_ls", name: "历", fullName: "历史", color: "history", char: "历" },
        "day_4_p_6": { courseId: "c_yy", name: "英", fullName: "英语", color: "english", char: "英" },
        "day_4_p_7": { courseId: "c_ty", name: "通", fullName: "通用技术", color: "tech", char: "通" },

        // 周五
        "day_5_p_morning": { courseId: "c_yy", name: "英", fullName: "英语", color: "english", char: "英" },
        "day_5_p_1": { courseId: "c_yy", name: "英", fullName: "英语", color: "english", char: "英" },
        "day_5_p_2": { courseId: "c_yw", name: "语", fullName: "语文", color: "chinese", char: "语" },
        "day_5_p_3": { courseId: "c_sx", name: "数", fullName: "数学", color: "math", char: "数" },
        "day_5_p_4": { courseId: "c_ms", name: "美", fullName: "美术/心理", color: "art", char: "美" },
        "day_5_p_noon": { courseId: "c_sx", name: "数", fullName: "数学", color: "math", char: "数" },
        "day_5_p_5": { courseId: "c_sw", name: "生", fullName: "生物", color: "biology", char: "生" },
        "day_5_p_6": { courseId: "c_pe", name: "体", fullName: "体育", color: "pe", char: "体" },
        "day_5_p_7": { courseId: "c_dl", name: "地", fullName: "地理", color: "geography", char: "地" }
    };

    const INITIAL_SCHEDULE_CLASS_3 = {
        id: "class_sched_chu2_3",
        shortName: "初二3",
        name: "初二 (3) 班",
        grade: "初二",
        sheet: "初中",
        teacher: "邹利珊",
        days: INITIAL_SCHEDULE_DAYS,
        periods: INITIAL_SCHEDULE_PERIODS,
        courseLibrary: INITIAL_COURSE_LIBRARY,
        grid: CLASS_3_GRID,
        lunchBreak: { enabled: true, afterPeriod: 4, name: "午间休息" },
        totalCourses: 45,
        updatedAt: BASE_TIME
    };

    const INITIAL_SCHEDULE_CLASS_4 = {
        id: "class_sched_chu2_4",
        shortName: "初二4",
        name: "初二 (4) 班",
        grade: "初二",
        sheet: "初中",
        teacher: "蓝康鑫",
        days: INITIAL_SCHEDULE_DAYS,
        periods: INITIAL_SCHEDULE_PERIODS,
        courseLibrary: INITIAL_COURSE_LIBRARY,
        grid: CLASS_4_GRID,
        lunchBreak: { enabled: true, afterPeriod: 4, name: "午间休息" },
        totalCourses: 45,
        updatedAt: BASE_TIME
    };

    const INITIAL_SCHEDULE_LIBRARY = [
        INITIAL_SCHEDULE_CLASS_3,
        INITIAL_SCHEDULE_CLASS_4
    ];

    // 默认活跃课表（采用初二3班）
    const INITIAL_SCHEDULE = {
        templateVersion: INITIAL_SCHEDULE_TEMPLATE_VERSION,
        id: INITIAL_SCHEDULE_CLASS_3.id,
        shortName: INITIAL_SCHEDULE_CLASS_3.shortName,
        name: INITIAL_SCHEDULE_CLASS_3.name,
        grade: INITIAL_SCHEDULE_CLASS_3.grade,
        sheet: INITIAL_SCHEDULE_CLASS_3.sheet,
        teacher: INITIAL_SCHEDULE_CLASS_3.teacher,
        days: INITIAL_SCHEDULE_DAYS,
        periods: INITIAL_SCHEDULE_PERIODS,
        courseLibrary: INITIAL_COURSE_LIBRARY,
        grid: CLASS_3_GRID,
        lunchBreak: {
            enabled: true,
            afterPeriod: 4,
            name: "午间休息"
        },
        totalCourses: 45,
        updatedAt: BASE_TIME
    };

    // 预设班干部结构与任职学生
    const INITIAL_OFFICERS = {
        roles: [
            {
                id: "role_monitor",
                name: "班长",
                order: 1,
                students: [
                    { studentId: 1, nameSnapshot: "林澈" },
                    { studentId: 16, nameSnapshot: "苏遥" }
                ]
            },
            {
                id: "role_secretary",
                name: "团支书",
                order: 2,
                students: [
                    { studentId: 2, nameSnapshot: "何予安" }
                ]
            },
            {
                id: "role_study",
                name: "学习委员",
                order: 3,
                students: [
                    { studentId: 3, nameSnapshot: "罗知夏" }
                ]
            },
            {
                id: "role_discipline",
                name: "纪律委员",
                order: 4,
                students: [
                    { studentId: 5, nameSnapshot: "谢明澈" },
                    { studentId: 22, nameSnapshot: "程野" }
                ]
            },
            {
                id: "role_hygiene",
                name: "卫生委员",
                order: 5,
                students: [
                    { studentId: 6, nameSnapshot: "邵清禾" }
                ]
            },
            {
                id: "role_sports",
                name: "体育委员",
                order: 6,
                students: [
                    { studentId: 10, nameSnapshot: "沈川" }
                ]
            },
            {
                id: "role_art",
                name: "文艺委员",
                order: 7,
                students: [
                    { studentId: 15, nameSnapshot: "白念初" }
                ]
            },
            {
                id: "role_rep_yw",
                name: "语文课代表",
                order: 8,
                students: [
                    { studentId: 4, nameSnapshot: "周宁" }
                ]
            },
            {
                id: "role_rep_sx",
                name: "数学课代表",
                order: 9,
                students: [
                    { studentId: 7, nameSnapshot: "许禾" }
                ]
            },
            {
                id: "role_rep_yy",
                name: "英语课代表",
                order: 10,
                students: [
                    { studentId: 8, nameSnapshot: "钟以宁" }
                ]
            },
            {
                id: "role_rep_wl",
                name: "物理课代表",
                order: 11,
                students: [
                    { studentId: 17, nameSnapshot: "魏予晴" }
                ]
            },
            {
                id: "role_rep_hx",
                name: "化学课代表",
                order: 12,
                students: [
                    { studentId: 11, nameSnapshot: "杜星遥" }
                ]
            }
        ],
        updatedAt: BASE_TIME
    };

    // 预设值日生表（周一至周五，4类岗位分工）
    const INITIAL_DUTY = {
        days: [
            { id: "dday_1", name: "周一", order: 1 },
            { id: "dday_2", name: "周二", order: 2 },
            { id: "dday_3", name: "周三", order: 3 },
            { id: "dday_4", name: "周四", order: 4 },
            { id: "dday_5", name: "周五", order: 5 }
        ],
        roles: [
            { id: "drole_clean", name: "地面扫拖", order: 1 },
            { id: "drole_board", name: "黑板讲台", order: 2 },
            { id: "drole_trash", name: "垃圾清运", order: 3 },
            { id: "drole_window", name: "门窗电源", order: 4 }
        ],
        assignments: {
            // 周一
            "dday_1_drole_clean": [
                { studentId: 1, nameSnapshot: "林澈" },
                { studentId: 2, nameSnapshot: "何予安" }
            ],
            "dday_1_drole_board": [
                { studentId: 3, nameSnapshot: "罗知夏" }
            ],
            "dday_1_drole_trash": [
                { studentId: 4, nameSnapshot: "周宁" }
            ],
            "dday_1_drole_window": [
                { studentId: 5, nameSnapshot: "谢明澈" }
            ],

            // 周二
            "dday_2_drole_clean": [
                { studentId: 6, nameSnapshot: "邵清禾" },
                { studentId: 7, nameSnapshot: "许禾" }
            ],
            "dday_2_drole_board": [
                { studentId: 8, nameSnapshot: "钟以宁" }
            ],
            "dday_2_drole_trash": [
                { studentId: 9, nameSnapshot: "余景然" }
            ],
            "dday_2_drole_window": [
                { studentId: 10, nameSnapshot: "沈川" }
            ],

            // 周三
            "dday_3_drole_clean": [
                { studentId: 11, nameSnapshot: "杜星遥" },
                { studentId: 12, nameSnapshot: "袁书言" }
            ],
            "dday_3_drole_board": [
                { studentId: 13, nameSnapshot: "唐安" }
            ],
            "dday_3_drole_trash": [
                { studentId: 14, nameSnapshot: "孟舒然" }
            ],
            "dday_3_drole_window": [
                { studentId: 15, nameSnapshot: "白念初" }
            ],

            // 周四
            "dday_4_drole_clean": [
                { studentId: 16, nameSnapshot: "苏遥" },
                { studentId: 17, nameSnapshot: "魏予晴" }
            ],
            "dday_4_drole_board": [
                { studentId: 18, nameSnapshot: "夏嘉树" }
            ],
            "dday_4_drole_trash": [
                { studentId: 19, nameSnapshot: "陆晴" }
            ],
            "dday_4_drole_window": [
                { studentId: 20, nameSnapshot: "彭知远" }
            ],

            // 周五
            "dday_5_drole_clean": [
                { studentId: 21, nameSnapshot: "侯若溪" },
                { studentId: 22, nameSnapshot: "程野" }
            ],
            "dday_5_drole_board": [
                { studentId: 23, nameSnapshot: "冯安禾" }
            ],
            "dday_5_drole_trash": [
                { studentId: 24, nameSnapshot: "郑沐川" }
            ],
            "dday_5_drole_window": [
                { studentId: 25, nameSnapshot: "叶舟" }
            ]
        },
        updatedAt: BASE_TIME
    };

    window.TWS3.initialData = {
        INITIAL_STUDENTS,
        INITIAL_TASKS,
        INITIAL_RECORDS,
        INITIAL_CLASS_NAME,
        INITIAL_CLASS_2_NAME,
        INITIAL_STUDENTS_CLASS_2,
        INITIAL_TASKS_CLASS_2,
        INITIAL_RECORDS_CLASS_2,
        INITIAL_SCHEDULE,
        INITIAL_SCHEDULE_DAYS,
        INITIAL_SCHEDULE_PERIODS,
        INITIAL_SCHEDULE_LIBRARY,
        INITIAL_SCHEDULE_CLASS_3,
        INITIAL_SCHEDULE_CLASS_4,
        DEFAULT_PERIOD_TIMES,
        INITIAL_SCHEDULE_TEMPLATE_VERSION,
        LEGACY_SCHEDULE_TEMPLATE,
        INITIAL_OFFICERS,
        INITIAL_DUTY,
        BASE_TIME
    };
})();
