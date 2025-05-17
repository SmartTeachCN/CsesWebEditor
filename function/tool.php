<?php
class tool
{
  public static function vaildTextSize($text, $maxLength)
  {
    return strlen($text) >= $maxLength;
  }
}