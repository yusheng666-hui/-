import WidgetKit
import SwiftUI

// 与 JS 侧共享的数据结构
struct WidgetData: Codable {
    let todayMood: String
    let streak: Int
    let checkedIn: Bool
    let updatedAt: String
}

struct Provider: TimelineProvider {
    let defaults = UserDefaults(suiteName: "group.com.emotional.rescue")

    func placeholder(in context: Context) -> SimpleEntry {
        SimpleEntry(date: Date(), todayMood: "😊", streak: 0, checkedIn: false)
    }

    func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> Void) {
        let entry = loadData()
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SimpleEntry>) -> Void) {
        let entry = loadData()
        // 每 30 分钟刷新一次
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 30, to: Date())!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }

    func loadData() -> SimpleEntry {
        guard let data = defaults?.data(forKey: "@widget:data"),
              let widgetData = try? JSONDecoder().decode(WidgetData.self, from: data) else {
            return SimpleEntry(date: Date(), todayMood: "", streak: 0, checkedIn: false)
        }
        return SimpleEntry(
            date: Date(),
            todayMood: widgetData.todayMood,
            streak: widgetData.streak,
            checkedIn: widgetData.checkedIn
        )
    }
}

struct SimpleEntry: TimelineEntry {
    let date: Date
    let todayMood: String
    let streak: Int
    let checkedIn: Bool
}

struct MoodWidgetEntryView: View {
    var entry: Provider.Entry

    var body: some View {
        VStack(spacing: 8) {
            if entry.checkedIn {
                Text(entry.todayMood)
                    .font(.system(size: 40))
                Text("\(entry.streak) 天")
                    .font(.caption)
                    .foregroundColor(.secondary)
            } else {
                Text("☁️")
                    .font(.system(size: 40))
                Text("签到")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .containerBackground(.background, for: .widget)
    }
}

@main
struct MoodWidget: Widget {
    let kind: String = "com.emotional.rescue.mood"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            MoodWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("心情签到")
        .description("查看今日心情和连续签到天数")
        .supportedFamilies([.systemSmall])
    }
}
