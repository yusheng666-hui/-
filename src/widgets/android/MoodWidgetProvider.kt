package com.emotional.rescue

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.widget.RemoteViews

class MoodWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    private fun updateAppWidget(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int
    ) {
        val prefs: SharedPreferences = context.getSharedPreferences("@widget:data", Context.MODE_PRIVATE)
        val todayMood = prefs.getString("todayMood", "") ?: ""
        val checkedIn = prefs.getBoolean("checkedIn", false)
        val streak = prefs.getInt("streak", 0)

        val views = RemoteViews(context.packageName, R.layout.mood_widget_layout)

        if (checkedIn) {
            views.setTextViewText(R.id.widget_mood_emoji, todayMood.ifEmpty { "☁️" })
            views.setTextViewText(R.id.widget_streak, "$streak 天")
        } else {
            views.setTextViewText(R.id.widget_mood_emoji, "☁️")
            views.setTextViewText(R.id.widget_streak, "签到")
        }

        // 点击 Widget 打开 App 到首页
        val intent = Intent(context, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            context, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.widget_container, pendingIntent)

        appWidgetManager.updateAppWidget(appWidgetId, views)
    }
}
