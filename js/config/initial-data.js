(function() {
    window.TWS3 = window.TWS3 || {};

    const BASE_TIME = "2026-06-20T08:00:00.000Z";

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

    const INITIAL_STUDENTS = INITIAL_STUDENT_NAMES.map((name, index) => {
        const id = index + 1;
        return {
            id: id,
            studentNo: String(id),
            name: name,
            isNonEnglish: false,
            updatedAt: BASE_TIME
        };
    });

    const INITIAL_TASKS = [
        { id: "task_0618", name: "0618语文默写", subject: "语文", archived: true, createdAt: "2026-06-18T08:00:00.000Z", updatedAt: "2026-06-18T08:00:00.000Z" },
        { id: "task_0619", name: "0619数学复习", subject: "数学", archived: true, createdAt: "2026-06-19T08:00:00.000Z", updatedAt: "2026-06-19T08:00:00.000Z" },
        { id: "task_0620", name: "0620作业", subject: "未设置", archived: false, createdAt: "2026-06-20T08:00:00.000Z", updatedAt: "2026-06-20T08:00:00.000Z" }
    ];

    const RAW_0620_RECORDS = {
        3: { status: "dark", badge: "2分" },
        7: { status: "white", badge: "未订正" },
        9: { status: "dark", badge: null },
        12: { status: "muted", badge: null },
        13: { status: "dark", badge: null },
        14: { status: "dark", badge: null },
        15: { status: "dark", badge: null },
        18: { status: "dark", badge: "迟交" },
        19: { status: "dark", badge: null },
        20: { status: "dark", badge: null },
        21: { status: "white", badge: "补交" },
        23: { status: "dark", badge: null },
        24: { status: "dark", badge: null },
        25: { status: "dark", badge: null },
        26: { status: "dark", badge: null },
        28: { status: "dark", badge: null },
        29: { status: "dark", badge: "1分" },
        30: { status: "dark", badge: null },
        33: { status: "dark", badge: null },
        34: { status: "dark", badge: null },
        35: { status: "dark", badge: null },
        37: { status: "muted", badge: null },
        38: { status: "dark", badge: null },
        39: { status: "dark", badge: null },
        40: { status: "dark", badge: null },
        41: { status: "dark", badge: null },
        43: { status: "dark", badge: null },
        44: { status: "dark", badge: null },
        45: { status: "dark", badge: null },
        48: { status: "dark", badge: null },
        49: { status: "dark", badge: null },
        50: { status: "dark", badge: null }
    };

    const INITIAL_RECORDS = {
        "task_0620": {}
    };

    for (let i = 1; i <= 50; i++) {
        const raw = RAW_0620_RECORDS[i] || { status: "white", badge: null };
        INITIAL_RECORDS["task_0620"][i] = {
            status: raw.status,
            badge: raw.badge,
            score: null,
            note: null,
            updatedAt: BASE_TIME
        };
    }

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

    const INITIAL_STUDENTS_CLASS_2 = INITIAL_STUDENT_NAMES_CLASS_2.map((name, index) => {
        const id = index + 1;
        return {
            id: id,
            studentNo: String(id),
            name: name,
            isNonEnglish: false,
            updatedAt: BASE_TIME
        };
    });

    const INITIAL_TASKS_CLASS_2 = [
        { id: "task_c2_0618", name: "0618语文默写", subject: "语文", archived: true, createdAt: "2026-06-18T08:00:00.000Z", updatedAt: "2026-06-18T08:00:00.000Z" },
        { id: "task_c2_0619", name: "0619数学复习", subject: "数学", archived: true, createdAt: "2026-06-19T08:00:00.000Z", updatedAt: "2026-06-19T08:00:00.000Z" },
        { id: "task_c2_0620", name: "0620作业", subject: "未设置", archived: false, createdAt: "2026-06-20T08:00:00.000Z", updatedAt: "2026-06-20T08:00:00.000Z" }
    ];

    const INITIAL_RECORDS_CLASS_2 = {
        "task_c2_0620": {}
    };

    for (let i = 1; i <= 50; i++) {
        INITIAL_RECORDS_CLASS_2["task_c2_0620"][i] = {
            status: "white",
            badge: null,
            score: null,
            note: null,
            updatedAt: BASE_TIME
        };
    }

    const INITIAL_CLASS_NAME = "高二 (3) 班";
    const INITIAL_SCHEDULE_TEMPLATE_VERSION = 2;

    // bcb74a7 中使用的默认课程表，仅用于识别未修改的旧模板。
    const LEGACY_SCHEDULE_TEMPLATE = {
        days: [
            { id: "day_1", name: "星期一", order: 1 },
            { id: "day_2", name: "星期二", order: 2 },
            { id: "day_3", name: "星期三", order: 3 },
            { id: "day_4", name: "星期四", order: 4 },
            { id: "day_5", name: "星期五", order: 5 }
        ],
        periods: [
            { id: "p_1", name: "第1节", order: 1 },
            { id: "p_2", name: "第2节", order: 2 },
            { id: "p_3", name: "第3节", order: 3 },
            { id: "p_4", name: "第4节", order: 4 },
            { id: "p_5", name: "第5节", order: 5 },
            { id: "p_6", name: "第6节", order: 6 },
            { id: "p_7", name: "第7节", order: 7 }
        ],
        courseLibrary: [
            { id: "c_yw", name: "语文", color: "blue" },
            { id: "c_sx", name: "数学", color: "amber" },
            { id: "c_yy", name: "英语", color: "purple" },
            { id: "c_wl", name: "物理", color: "cyan" },
            { id: "c_hx", name: "化学", color: "emerald" },
            { id: "c_sw", name: "生物", color: "green" },
            { id: "c_zz", name: "政治", color: "red" },
            { id: "c_ls", name: "历史", color: "orange" },
            { id: "c_dl", name: "地理", color: "teal" },
            { id: "c_ty", name: "体育", color: "rose" },
            { id: "c_ms", name: "美术", color: "pink" },
            { id: "c_yy2", name: "音乐", color: "indigo" },
            { id: "c_xx", name: "信息技术", color: "sky" },
            { id: "c_bh", name: "班会", color: "slate" }
        ],
        grid: {
            "day_1_p_1": { courseId: "c_yw", customName: "" },
            "day_1_p_2": { courseId: "c_sx", customName: "" },
            "day_1_p_3": { courseId: "c_yy", customName: "" },
            "day_1_p_4": { courseId: "c_wl", customName: "" },
            "day_1_p_5": { courseId: "c_hx", customName: "" },
            "day_1_p_6": { courseId: "c_sw", customName: "" },
            "day_1_p_7": { courseId: "c_bh", customName: "" },
            "day_2_p_1": { courseId: "c_sx", customName: "" },
            "day_2_p_2": { courseId: "c_yw", customName: "" },
            "day_2_p_3": { courseId: "c_yy", customName: "" },
            "day_2_p_4": { courseId: "c_ls", customName: "" },
            "day_2_p_5": { courseId: "c_dl", customName: "" },
            "day_2_p_6": { courseId: "c_zz", customName: "" },
            "day_2_p_7": { courseId: "c_ty", customName: "" },
            "day_3_p_1": { courseId: "c_yy", customName: "" },
            "day_3_p_2": { courseId: "c_sx", customName: "" },
            "day_3_p_3": { courseId: "c_yw", customName: "" },
            "day_3_p_4": { courseId: "c_wl", customName: "" },
            "day_3_p_5": { courseId: "c_hx", customName: "" },
            "day_3_p_6": { courseId: "c_yy2", customName: "" },
            "day_3_p_7": { courseId: "c_xx", customName: "" },
            "day_4_p_1": { courseId: "c_yw", customName: "" },
            "day_4_p_2": { courseId: "c_sx", customName: "" },
            "day_4_p_3": { courseId: "c_yy", customName: "" },
            "day_4_p_4": { courseId: "c_sw", customName: "" },
            "day_4_p_5": { courseId: "c_zz", customName: "" },
            "day_4_p_6": { courseId: "c_ls", customName: "" },
            "day_4_p_7": { courseId: "c_ms", customName: "" },
            "day_5_p_1": { courseId: "c_sx", customName: "" },
            "day_5_p_2": { courseId: "c_yy", customName: "" },
            "day_5_p_3": { courseId: "c_yw", customName: "" },
            "day_5_p_4": { courseId: "c_dl", customName: "" },
            "day_5_p_5": { courseId: "c_wl", customName: "" },
            "day_5_p_6": { courseId: "c_hx", customName: "" },
            "day_5_p_7": { courseId: "c_ty", customName: "" }
        }
    };

    const INITIAL_SCHEDULE_DAYS = [
        { id: "day_1", name: "周一", order: 1 },
        { id: "day_2", name: "周二", order: 2 },
        { id: "day_3", name: "周三", order: 3 },
        { id: "day_4", name: "周四", order: 4 },
        { id: "day_5", name: "周五", order: 5 }
    ];

    const INITIAL_SCHEDULE_PERIODS = [
        { id: "p_1", name: "1", order: 1 },
        { id: "p_2", name: "2", order: 2 },
        { id: "p_3", name: "3", order: 3 },
        { id: "p_4", name: "4", order: 4 },
        { id: "p_5", name: "5", order: 5 },
        { id: "p_6", name: "6", order: 6 },
        { id: "p_7", name: "7", order: 7 }
    ];

    const INITIAL_COURSE_LIBRARY = [
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
    ];

    const INITIAL_SCHEDULE_GRID = {
        // 周一
        "day_1_p_1": { courseId: "c_yy", customName: "" },
        "day_1_p_2": { courseId: "c_sx", customName: "" },
        "day_1_p_3": { courseId: "c_ty", customName: "" },
        "day_1_p_4": { courseId: "c_zz", customName: "" },
        "day_1_p_5": { courseId: "c_ms", customName: "" },
        "day_1_p_6": { courseId: "c_sw", customName: "" },
        "day_1_p_7": { courseId: "c_bh", customName: "" },

        // 周二
        "day_2_p_1": { courseId: "c_yw", customName: "" },
        "day_2_p_2": { courseId: "c_ls", customName: "" },
        "day_2_p_3": { courseId: "c_sx", customName: "" },
        "day_2_p_4": { courseId: "c_yy", customName: "" },
        "day_2_p_5": { courseId: "c_wh", customName: "" },
        "day_2_p_6": { courseId: "c_xx", customName: "" },
        "day_2_p_7": { courseId: "c_pe", customName: "" },

        // 周三
        "day_3_p_1": { courseId: "c_yy", customName: "" },
        "day_3_p_2": { courseId: "c_ls", customName: "" },
        "day_3_p_3": { courseId: "c_yw", customName: "" },
        "day_3_p_4": { courseId: "c_sx", customName: "" },
        "day_3_p_5": { courseId: "c_mu", customName: "" },
        "day_3_p_6": { courseId: "c_dh", customName: "" },
        "day_3_p_7": { courseId: "c_zz", customName: "" },

        // 周四
        "day_4_p_1": { courseId: "c_yw", customName: "" },
        "day_4_p_2": { courseId: "c_yw", customName: "" },
        "day_4_p_3": { courseId: "c_ls", customName: "" },
        "day_4_p_4": { courseId: "c_sw", customName: "" },
        "day_4_p_5": { courseId: "c_yy", customName: "" },
        "day_4_p_6": { courseId: "c_sx", customName: "" },
        // 星期四第7节为用户确认参考图中的空白项

        // 周五
        "day_5_p_1": { courseId: "c_yy", customName: "" },
        "day_5_p_2": { courseId: "c_sx", customName: "" },
        "day_5_p_3": { courseId: "c_sw", customName: "" },
        "day_5_p_4": { courseId: "c_yw", customName: "" },
        "day_5_p_5": { courseId: "c_hh", customName: "" },
        "day_5_p_6": { courseId: "c_zz", customName: "" },
        "day_5_p_7": { courseId: "c_pe", customName: "" }
    };

    const INITIAL_SCHEDULE = {
        templateVersion: INITIAL_SCHEDULE_TEMPLATE_VERSION,
        days: INITIAL_SCHEDULE_DAYS,
        periods: INITIAL_SCHEDULE_PERIODS,
        courseLibrary: INITIAL_COURSE_LIBRARY,
        grid: INITIAL_SCHEDULE_GRID,
        lunchBreak: {
            enabled: true,
            afterPeriod: 4,
            name: "午间休息"
        },
        updatedAt: BASE_TIME
    };
    const INITIAL_OFFICERS = {
        roles: [],
        updatedAt: BASE_TIME
    };

    const INITIAL_DUTY = {
        days: [],
        roles: [],
        assignments: {},
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
        INITIAL_SCHEDULE_TEMPLATE_VERSION,
        LEGACY_SCHEDULE_TEMPLATE,
        INITIAL_OFFICERS,
        INITIAL_DUTY,
        BASE_TIME
    };
})();
