<?php
class tool
{
  public static function vaildTextSize($text, $maxLength)
  {
    return strlen($text) >= $maxLength;
  }

  /**
   * 输出 JSON 并结束请求。
   * 统一设置响应头，避免各分支漏设导致的乱码/类型错误。
   */
  public static function json($data, $status = 200)
  {
    if (!headers_sent()) {
      header('Content-Type: application/json; charset=utf-8');
      if ($status !== 200) {
        http_response_code($status);
      }
    }
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
  }

  /**
   * 实例组标识：由 user::getDir() 生成，固定为 10 位小写字母/数字。
   * 这里放宽到 4~64 位字母数字与 _-，但绝不允许 . / \ 等路径字符，
   * 否则 subuser::dirById() 会被 ../ 穿越到其他目录。
   */
  public static function validDirId($id)
  {
    if (!is_string($id)) return false;
    return preg_match('/^[A-Za-z0-9_-]{4,64}$/', $id) === 1;
  }

  /**
   * 实例ID（配置文件名主体）。
   * 允许中文等宽字符，但禁止路径分隔符、.. 与首字符为 . 的隐藏文件，
   * 避免 user/<dir>/<terminalId>.cses 被穿越。
   */
  public static function validTerminalId($id)
  {
    if (!is_string($id) || $id === '') return false;
    if (strlen($id) > 180) return false;
    if ($id[0] === '.') return false;
    if (strpos($id, '..') !== false) return false;
    return preg_match('/^[^\/\\\\:*?"<>|\x00-\x1F]+$/u', $id) === 1;
  }

  /** 子用户名：与实例ID同级限制，且不允许空白 */
  public static function validUsername($name)
  {
    if (!is_string($name) || $name === '') return false;
    if (strlen($name) > 96) return false;
    if ($name[0] === '.' || strpos($name, '..') !== false) return false;
    return preg_match('/^[^\s\/\\\\:*?"<>|\x00-\x1F]+$/u', $name) === 1;
  }
}
