<?PHP
class uiConfig
{
    public static function editors()
    {
        return [
            'cloud' => ['display' => 'block'],
            'schedule' => ['display' => 'none'],
            'source' => ['display' => 'none'],
            'control' => ['display' => 'none'],
            'subject' => ['display' => 'none']
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
                'selected' => true,
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
                'des' => '课程档案',
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