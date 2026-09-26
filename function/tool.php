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
   * 数据里若混入非 UTF-8 字节（历史实例名/用户名可能是 GBK），json_encode 会返回
   * false 并输出空响应，这里退化为「逐字段清洗后再编码」，保证客户端始终能拿到 JSON。
   */
  public static function json($data, $status = 200)
  {
    if (!headers_sent()) {
      header('Content-Type: application/json; charset=utf-8');
      if ($status !== 200) {
        http_response_code($status);
      }
    }
    $body = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($body === false) {
      $body = json_encode(self::utf8Safe($data), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
    if ($body === false) {
      http_response_code(500);
      $body = '{"success":false,"error":"响应序列化失败"}';
    }
    echo $body;
    exit;
  }

  /** 递归把任意值清洗成可 json_encode 的 UTF-8 结构 */
  private static function utf8Safe($value, $depth = 0)
  {
    if ($depth > 16) return null;
    if (is_array($value)) {
      $out = [];
      foreach ($value as $k => $v) {
        $out[self::utf8Safe($k, $depth + 1)] = self::utf8Safe($v, $depth + 1);
      }
      return $out;
    }
    if (is_object($value)) {
      return self::utf8Safe(get_object_vars($value), $depth + 1);
    }
    if (is_string($value)) {
      if ($value === '' || preg_match('//u', $value)) return $value;
      if (function_exists('mb_convert_encoding')) {
        return mb_convert_encoding($value, 'UTF-8', 'UTF-8');
      }
      if (function_exists('iconv')) {
        $converted = @iconv('UTF-8', 'UTF-8//IGNORE', $value);
        if ($converted !== false) return $converted;
      }
      return preg_replace('/[\x80-\xFF]/', '?', $value);
    }
    return $value;
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
