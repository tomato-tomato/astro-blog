// 站点级文案与常量。任何会出现在界面上的站名、简介都只从这里取，
// 组件里不要另写一份，否则改名时会漏掉页脚和 RSS。

/**
 * 站点名与一句话简介。全站唯一来源：页头 wordmark、页脚署名、`<title>`、
 * `og:site_name`、RSS 标题、以及各列表页的默认 description 都取自这里。
 *
 * 「自留地」= 自己那一小块地，每天去侍弄一下；英文短名 Plot 只用于域名与外部标识，
 * 不进界面。改名字只改这两行，不用去翻组件。
 */
export const SITE_TITLE = "自留地";
export const SITE_DESCRIPTION = "前端出身，把服务端和 AI 一点点弄明白。";

/**
 * 首页「最新文章」展示的卡片数量。
 * 写死在这里，文章再多首页也不会被拉长；改一个数字即可调整。
 */
export const HOME_LATEST_COUNT = 3;
