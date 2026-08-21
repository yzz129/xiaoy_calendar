package com.xiaoy.calendar;

import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ExternalBrowser")
public class ExternalBrowserPlugin extends Plugin {
    @PluginMethod
    public void open(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isBlank()) {
            call.reject("缺少链接地址");
            return;
        }

        Uri uri = Uri.parse(url);
        String scheme = uri.getScheme();
        if (!"https".equalsIgnoreCase(scheme) && !"http".equalsIgnoreCase(scheme)) {
            call.reject("只允许打开 http 或 https 链接");
            return;
        }

        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            getActivity().startActivity(intent);
            call.resolve(new JSObject());
        } catch (Exception exception) {
            call.reject("无法打开系统浏览器", exception);
        }
    }
}
