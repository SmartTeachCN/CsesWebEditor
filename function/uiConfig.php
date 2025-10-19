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
                'des' => '终端管理',
                'icon' => 'bi-cloud',
                'text' => '终端',
                'online' => true,
                'selected' => $isLoggedIn ? true : false
            ],
            [
                'view' => 'control',
                'des' => '集控配置',
                'icon' => 'bi-gear-wide-connected',
                'text' => '配置',
                'online' => true
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
}