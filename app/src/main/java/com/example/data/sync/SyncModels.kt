package com.example.data.sync

enum class SyncStatus(val labelBn: String) {
    SYNCED("সিঙ্ক সম্পন্ন"),
    SYNCING("সিঙ্ক হচ্ছে..."),
    PENDING("সিঙ্ক বাকি"),
    LOCAL_SAVED("ক্লাউড সেটআপ বাকি"),
    OFFLINE("অফলাইন মোড"),
    ERROR("সিঙ্ক ব্যর্থ")
}

data class SyncState(
    val status: SyncStatus = SyncStatus.LOCAL_SAVED,
    val statusText: String = "লোকাল ডেটা সংরক্ষিত — ক্লাউড সেটআপ বাকি",
    val pendingCount: Int = 0,
    val lastSyncTime: Long = System.currentTimeMillis(),
    val isCloudConfigured: Boolean = false,
    val errorMessage: String? = null
)

/**
 * Tombstone marker to track deleted records across multiple devices.
 * Prevents stale devices from re-uploading or resurrecting deleted items.
 */
data class Tombstone(
    val id: String,
    val tableName: String,
    val originalId: String,
    val deletedAt: Long = System.currentTimeMillis(),
    val isPermanent: Boolean = false,
    val deletedByUserId: String = ""
)

/**
 * Diagnostic record capturing the exact Firebase operation, document path,
 * error code, and authentication status during business linking or sync.
 * Strictly masks confidential tokens, PINs, and credentials.
 */
data class ConnectionDiagnosticReport(
    val stepName: String = "",
    val operationType: String = "", // e.g. "GET", "SET", "LIST"
    val documentPath: String = "",
    val errorCode: String = "",
    val briefReason: String = "",
    val rawExceptionMessage: String = "",
    val isSignedIn: Boolean = false,
    val authUidMasked: String = "",
    val authEmailMasked: String = "",
    val businessCodeMasked: String = "",
    val phoneMasked: String = "",
    val isSuccess: Boolean = false,
    val timestamp: Long = System.currentTimeMillis()
) {
    fun toFormattedReport(): String {
        return buildString {
            appendLine("=== স্মার্ট বিজনেস ক্লাউড ডায়াগনস্টিক রিপোর্ট ===")
            appendLine("ধাপ: $stepName")
            appendLine("ফলাফল: ${if (isSuccess) "সফল (SUCCESS)" else "ব্যর্থ (FAILED)"}")
            appendLine("অপারেশন: ${operationType.ifBlank { "N/A" }}")
            appendLine("ডকুমেন্ট পাথ: ${documentPath.ifBlank { "N/A" }}")
            appendLine("ত্রুটি কোড: ${errorCode.ifBlank { "NONE" }}")
            appendLine("কারণ: $briefReason")
            if (rawExceptionMessage.isNotBlank()) {
                appendLine("মূল এক্সেপশন: $rawExceptionMessage")
            }
            appendLine("গুগল সাইন-ইন: ${if (isSignedIn) "হ্যাঁ (UID: $authUidMasked, Email: $authEmailMasked)" else "না (সাইন-ইন করা নেই)"}")
            appendLine("বিজনেস কোড: $businessCodeMasked")
            appendLine("মোবাইল নম্বর: $phoneMasked")
            val dateStr = try {
                java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss", java.util.Locale.getDefault()).format(java.util.Date(timestamp))
            } catch (_: Exception) {
                timestamp.toString()
            }
            appendLine("সময়: $dateStr")
            appendLine("=============================================")
        }
    }

    companion object {
        fun maskId(id: String): String {
            val clean = id.trim()
            if (clean.length <= 8) return clean
            return "${clean.take(4)}...${clean.takeLast(4)}"
        }

        fun maskEmail(email: String): String {
            val clean = email.trim()
            val at = clean.indexOf('@')
            if (at <= 1) return clean
            val prefix = clean.substring(0, 2)
            val domain = clean.substring(at)
            return "$prefix***$domain"
        }

        fun maskPhone(phone: String): String {
            val clean = phone.trim()
            if (clean.length <= 6) return clean
            return "${clean.take(3)}****${clean.takeLast(4)}"
        }
    }
}

