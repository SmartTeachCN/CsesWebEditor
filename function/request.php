<?php
class request
{
  public static function handleRequest()
  {
    $isApi = ($_SERVER['REQUEST_METHOD'] === 'POST') || isset($_GET['action']);
    if (!$isApi) return;

    // 这是个纯 JSON 接口：无论走到哪一步出错，都应该返回 JSON 而不是一个空白 500，
    // 否则前端只能拿到「服务器错误」而无法定位（历史上子用户迁移就踩过这个坑）。
    register_shutdown_function(['request', 'fatalHandler']);
    try {
      if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        request::post($_POST);
      } elseif (isset($_GET['action'])) {
        request::get($_GET);
      }
    } catch (\Throwable $e) {
      request::fail($e);
    }
  }

  /** 是否可以把内部错误细节返回给调用方（仅登录用户 / 调试模式） */
  private static function debugAllowed()
  {
    if (!empty($GLOBALS['debugMode'])) return true;
    return !empty($_SESSION['user']['id']);
  }

  /** 未捕获的异常/错误 -> JSON */
  public static function fail($e)
  {
    $detail = request::debugAllowed()
      ? (get_class($e) . ': ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine())
      : '服务器内部错误，请稍后重试';
    if (function_exists('error_log')) {
      @error_log('[cses] ' . $detail);
    }
    tool::json(['success' => false, 'error' => $detail], 500);
  }

  /** 兜底：致命错误（E_ERROR 级别）也要以 JSON 形式返回 */
  public static function fatalHandler()
  {
    $err = error_get_last();
    if (!$err || !in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR, E_RECOVERABLE_ERROR], true)) {
      return;
    }
    if (headers_sent()) {
      return; // 已经有输出（例如 display_errors 打印了堆栈），不追加内容以免破坏响应
    }
    $detail = request::debugAllowed()
      ? ($err['message'] . ' @ ' . $err['file'] . ':' . $err['line'])
      : '服务器内部错误，请稍后重试';
    @error_log('[cses][fatal] ' . $err['message'] . ' @ ' . $err['file'] . ':' . $err['line']);
    tool::json(['success' => false, 'error' => $detail], 500);
  }

  /**
   * POST 入口。
   * - 子用户主人操作（addSubUser / delSubUser / setSubAllowed）与子用户侧操作
   *   （subList / subLoad / subSave）都在最前面处理：
   *   子用户没有登录态，凭据本身就是身份，因此不能要求 session。
   * - 其余请求视为「保存实例配置」，必须登录。
   */
  public static function post($postData)
  {
    header('Content-Type: application/json; charset=utf-8');
    if (isset($postData['action'])) {
      switch ($postData['action']) {
        case 'addSubUser':
          subuser::addForOwner(
            $postData['terminalId'] ?? '',
            $postData['username'] ?? '',
            $postData['secret'] ?? '',
            $postData['allowed'] ?? null
          );
          break;
        case 'delSubUser':
          subuser::deleteForOwner($postData['terminalId'] ?? '', $postData['username'] ?? '');
          break;
        case 'setSubAllowed':
          subuser::setAllowedForOwner(
            $postData['terminalId'] ?? '',
            $postData['username'] ?? '',
            $postData['allowed'] ?? null
          );
          break;
        // 子用户侧认证相关一律使用 POST，避免密钥出现在 URL / 访问日志 / 浏览器历史中
        case 'subList':
          subuser::subList(
            $postData['directoryId'] ?? '',
            $postData['subUsername'] ?? '',
            $postData['subSecret'] ?? ''
          );
          break;
        case 'subLoad':
          subuser::subLoad(
            $postData['directoryId'] ?? '',
            $postData['subUsername'] ?? '',
            $postData['subSecret'] ?? '',
            $postData['terminalId'] ?? ''
          );
          break;
        case 'subSave':
          subuser::subSave(
            $postData['directoryId'] ?? '',
            $postData['subUsername'] ?? '',
            $postData['subSecret'] ?? '',
            $postData['terminalId'] ?? '',
            $postData['config'] ?? ''
          );
          break;
        default:
          echo json_encode(['success' => false, 'error' => '未知操作'], JSON_UNESCAPED_UNICODE);
          exit;
      }
      return;
    }

    if (!isset($_SESSION['user']['id'])) {
      echo json_encode(['success' => false, 'error' => '未登录'], JSON_UNESCAPED_UNICODE);
      exit;
    }

    $config = $postData['config'] ?? '';
    $terminalId = $postData['terminalId'] ?? '';

    terminal::vaildateId($terminalId);
    if (tool::vaildTextSize($config, 250000)) {
      echo json_encode(['success' => false, 'error' => '配置长度超过限制'], JSON_UNESCAPED_UNICODE);
      exit;
    }

    terminal::saveConfig($config, $terminalId, $_SESSION['user']['id']);
    echo json_encode(['success' => true], JSON_UNESCAPED_UNICODE);
  }

  public static function get($getParams)
  {
    header('Content-Type: application/json; charset=utf-8');
    $action = $getParams['action'];

    switch ($action) {
      case 'load':
        terminal::vaildateId($getParams['terminalId'] ?? '');
        terminal::loadConfig($getParams['terminalId'] ?? '');
        break;
      case 'getId':
        if (!isset($_SESSION['user']['id'])) {
          echo json_encode(['success' => false, 'error' => '未登录'], JSON_UNESCAPED_UNICODE);
          exit;
        }
        user::getCid();
        break;
      case 'del':
        if (!isset($_SESSION['user']['id'])) {
          echo json_encode(['success' => false, 'error' => '未登录'], JSON_UNESCAPED_UNICODE);
          exit;
        }
        terminal::vaildateId($getParams['terminalId'] ?? '');
        terminal::delete($getParams['terminalId'] ?? '');
        break;
      case 'listTerminals':
        terminal::list();
        break;
      case 'getSubSecret':
        terminal::vaildateId($getParams['terminalId'] ?? '');
        subuser::getSecretForOwner($getParams['terminalId'] ?? '', $getParams['username'] ?? '');
        break;
      case 'getSubUsers':
        terminal::vaildateId($getParams['terminalId'] ?? '');
        subuser::getForOwner($getParams['terminalId'] ?? '');
        break;
      // 已废弃：子用户凭据不再允许通过 URL 传递
      case 'subList':
      case 'subLoad':
        echo json_encode([
          'success' => false,
          'error' => '出于安全考虑，子用户认证已改为 POST 提交，请刷新页面后重试',
        ], JSON_UNESCAPED_UNICODE);
        exit;
      case "logout":
        user::logout();
        break;
      case 'spaceConfig':
        saveSpaceConfig();
        break;
      case 'joinSpace':
        handleJoinSpace($_GET);
        break;
      default:
        echo json_encode([], JSON_UNESCAPED_UNICODE);
        exit;
    }
  }
}
