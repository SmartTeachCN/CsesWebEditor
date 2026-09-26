<?PHP
class uiConfig
{
    public static function editors()
    {
        $isLoggedIn = isset($_SESSION['user']) && !empty($_SESSION['user']['id']);
        return [
            'cloud' => ['display' => $isLoggedIn ? 'block' : 'none'],
            'schedule' => ['display' => $isLoggedIn ? 'none' : 'block'],
            'source' => ['display' => 'none'],
            'control' => ['display' => 'none'],
            'subject' => ['display' => 'none'],
            'time' => ['display' => 'none'],
            'change' => ['display' => 'none']
        ];
    }
    public static function leftBar()
    {
        $isLoggedIn = isset($_SESSION['user']) && !empty($_SESSION['user']['id']);
        return [
            [
                'view' => 'cloud',
                'des' => '实例管理',
                'icon' => 'bi-cloud',
                'text' => '实例',
                'online' => true,
                'selected' => $isLoggedIn ? true : false
            ],
            [
                'view' => 'control',
                'des' => '集控配置',
                'icon' => 'bi-gear-wide-connected',
                'text' => '配置'
            ],
            [
                'view' => 'schedule',
                'des' => '档案管理',
                'icon' => 'bi-calendar',
                'text' => '档案',
                'selected' => $isLoggedIn ? false : true
            ],
            [
                'view' => 'source',
                'des' => '文件预览',
                'icon' => 'bi-file-earmark-text',
                'text' => '文件'
            ]
        ];
    }

    /**
     * 子用户面板的功能栏。
     * 与主面板同名同序（实例 / 配置 / 档案 / 文件），
     * 因此可以直接复用主面板的 pages/editor/{cloud,control,schedule,source}.html 区块。
     */
    public static function subuserLeftBar()
    {
        return [
            [
                'view' => 'cloud',
                'des' => '实例',
                'icon' => 'bi-cloud',
                'text' => '实例',
                'selected' => true
            ],
            [
                'view' => 'control',
                'des' => '集控配置',
                'icon' => 'bi-gear-wide-connected',
                'text' => '配置'
            ],
            [
                'view' => 'schedule',
                'des' => '档案管理',
                'icon' => 'bi-calendar',
                'text' => '档案'
            ],
            [
                'view' => 'source',
                'des' => '文件预览',
                'icon' => 'bi-file-earmark-text',
                'text' => '文件'
            ]
        ];
    }
}
