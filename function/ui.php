<?php
class ui
{
    public static function renderEditors($editors): void
    {
        echo "<iframe id='editor-frame' class='editor-frame' style='width:100%;height:100%;border:0;display:block;background:transparent'></iframe>";
    }
    public static function renderSideBar($items, $mobile = false): void
    {
        if (!$mobile)
            echo '<fluent-listbox class="activity-bar">';
        foreach ($items as $item) {
            $classes = 'activity-item';
            if (!empty($item['selected']))
                $classes .= ' selected';
            if (!empty($item['online']))
                $classes .= ' online';

            if ($mobile) {
                echo sprintf(
                    '<button class="%s" data-view="%s" data-des="%s"><i class="bi %s"></i><span>%s</span></button>',
                    $classes,
                    $item['view'],
                    $item['des'],
                    $item['icon'],
                    $item['des']
                );
            } else {
                echo sprintf(
                    '<button class="%s" data-view="%s" data-des="%s"><i class="bi %s"></i>%s</button>',
                    $classes,
                    $item['view'],
                    $item['des'],
                    $item['icon'],
                    $item['text']
                );
            }
        }
        echo '</fluent-listbox>';
    }
}
