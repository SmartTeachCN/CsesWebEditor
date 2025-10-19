<?PHP
class uiConfig
{
    public static function editors()
    {
        return [
            'cloud' => ['display' => 'none'],
            'schedule' => ['display' => 'block'],
            'source' => ['display' => 'none'],
            'control' => ['display' => 'none'],
            'subject' => ['display' => 'none'],
            'time' => ['display' => 'none'],
            'change' => ['display' => 'none']
        ];
    }
    public static function leftBar()
    {
        return [
            [
                'view' => 'cloud',
                'des' => '终端管理',
                'icon' => 'bi-cloud',
                'text' => '终端',
                'online' => true
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
                'selected' => true
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