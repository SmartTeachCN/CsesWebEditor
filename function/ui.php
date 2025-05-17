<?php
class ui
{
    public static function renderEditors($editors): void
    {
        foreach ($editors as $key => $editor) {
            echo "<div class='editor' id='{$key}-editor' style='display: {$editor['display']};'>";
            include "pages/editor/{$key}.html";
            echo "</div>";
        }
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