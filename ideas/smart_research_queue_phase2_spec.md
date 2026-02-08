# Smart Research Queue Phase 2 (Bản non-tech-ready cho stakeholder)

Tài liệu này viết lại từ bản kỹ thuật, giữ nguyên phạm vi Phase 2 và ưu tiên ngôn ngữ dễ hiểu để các bên Sản phẩm, Thiết kế, Kỹ thuật, QA cùng chốt nhanh.

## Mục tiêu

Phase 2 chuyển Smart Research Queue từ "chỗ chứa ghi chú" thành "trợ lý giúp nhớ và nối ý".

Kết quả cần có trong phase này:
- Nhắc người dùng ôn lại khi ghi chú tồn quá nhiều.
- Tự gợi ý các ghi chú liên quan để người dùng thấy bức tranh lớn.
- Gửi bản tổng hợp định kỳ để người dùng không bỏ sót việc cần ôn.
- Lưu ảnh chụp nhỏ tại thời điểm bôi đậm để dễ nhớ ngữ cảnh.
- Hiển thị tiến trình theo tuần trong thanh bên.
- Cho phép công cụ AI bên ngoài đọc dữ liệu qua cầu nối MCP.

Giải thích ngắn về từ kỹ thuật bắt buộc:
- MCP là chuẩn kết nối để công cụ AI xin dữ liệu theo cách có kiểm soát.

Giới hạn bắt buộc:
- Không thêm dịch vụ máy chủ mới bên ngoài.
- Người dùng luôn có quyền bật/tắt từng tính năng.
- Nội dung hiển thị cho người dùng không dùng từ kỹ thuật khó hiểu.

Quyết định hành động:
- Design: Dùng nhãn thân thiện như "Nhắc ôn tập", "Ghi chú liên quan", "Tổng hợp hôm nay".
- Dev: Giữ nguyên các nhóm chức năng trong Phase 2, không thêm tính năng ngoài danh sách trên.
- QA: Kiểm tra đúng ngưỡng kích hoạt và đúng trạng thái bật/tắt của người dùng.

## Người dùng

Nhóm chính:
- Người đọc tài liệu nhiều tab và hay bôi đậm nhanh nhưng chưa kịp ôn lại.
- Người cần gom ý tưởng thành ghi chú có thể xuất ra sổ nghiên cứu.

Nhóm mở rộng:
- Người dùng nâng cao muốn dùng trợ lý AI ngoài trình duyệt để hỏi lại dữ liệu đã đọc.

Không phải nhóm mục tiêu chính trong phase này:
- Người cần cộng tác nhóm thời gian thực.
- Người cần đồng bộ nhiều thiết bị qua đám mây.

Ví dụ thực tế:
- "Lan đọc 8 bài về AI trong buổi sáng, đến chiều nhận nhắc ôn 5 ghi chú cũ trước khi đọc tiếp."
- "Minh mở lại một ghi chú và thấy 3 ghi chú liên quan, từ đó quyết định xuất cả cụm thay vì từng mảnh rời."

Quyết định hành động:
- Design: Ưu tiên luồng cho người đọc cá nhân, ít thao tác.
- Dev: Tối ưu cho dữ liệu cục bộ trước, không phụ thuộc hệ thống ngoài.
- QA: Test theo 2 nhóm người dùng trên, không mở rộng sang luồng cộng tác.

## Trải nghiệm mong muốn

Người dùng cảm thấy sản phẩm:
- Nhắc đúng lúc, không làm phiền liên tục.
- Giúp nhìn ra liên hệ giữa các ý đã lưu.
- Cho cảm giác "mình đang tiến bộ" qua số liệu tuần.
- Minh bạch việc dữ liệu ở đâu và ai được truy cập.

Mẫu microcopy gợi ý:
- Nhắc ôn tập: "Bạn có 5 ghi chú đang chờ xem lại. Ôn nhanh 3 phút trước khi đọc tiếp nhé?"
- Nút hành động: "Ôn ngay" | "Nhắc lại sau" | "Đóng"
- Ghi chú liên quan: "Có 3 ghi chú liên quan, bạn muốn xem luôn không?"
- Tổng hợp định kỳ: "Hôm nay bạn đã lưu 7 ghi chú trong 2 chủ đề."
- MCP: "Dữ liệu vẫn ở trên máy của bạn. Bạn có thể tắt kết nối bất cứ lúc nào."

Quyết định hành động:
- Design: Mỗi thành phần phải có 1 câu lợi ích rõ ràng và tối đa 2 nút chính.
- Dev: Luồng nhắc và tổng hợp phải mở đúng khu vực trong thanh bên.
- QA: Kiểm tra microcopy đúng ngữ cảnh và không có từ nội bộ kỹ thuật.

## Luồng chính

### 1) Luồng Nhắc ôn tập

Khi nào hiện:
- Có từ 5 ghi chú chờ ôn trở lên.
- Ghi chú cũ nhất đã quá 4 giờ.
- Mức hiểu hiện tại còn thấp (dưới ngưỡng 60).
- Trong 60 phút gần nhất chưa nhắc lại.
- Không ở chế độ đọc tra cứu.

Người dùng thấy gì:
- Thẻ nhắc nhỏ ở góc dưới phải, không khóa màn hình.

Người dùng làm gì:
- Chọn "Ôn ngay" để mở thanh bên vào phần ôn.
- Chọn "Nhắc lại sau" để hoãn 60 phút.
- Chọn "Đóng" để tạm không nhắc trong 4 giờ.

Ví dụ:
- "Bạn có 6 ghi chú đang chờ. Ôn nhanh trước khi đọc tiếp nhé?"

### 2) Luồng Ghi chú liên quan

Khi nào chạy:
- Sau khi tạo ghi chú mới, hệ thống tự tìm tối đa 5 ghi chú liên quan.
- Chỉ giữ liên quan có độ giống đủ cao (từ 0.65 trở lên).

Người dùng thấy gì:
- Dưới mỗi ghi chú có mục "Ghi chú liên quan".
- Mỗi mục có nhãn dễ hiểu như "Tương tự", "Mở rộng", "Mâu thuẫn".

Người dùng làm gì:
- Bấm vào ghi chú liên quan để đọc nhanh và quyết định có xuất cùng hay không.

Ví dụ:
- "Ghi chú này liên quan đến 2 ghi chú trước: 1 Tương tự, 1 Mở rộng."

### 3) Luồng Tổng hợp định kỳ (Heartbeat)

Giải thích ngắn từ kỹ thuật:
- Heartbeat là bản tổng hợp tự chạy theo chu kỳ để nhắc việc cần làm.

Khi nào chạy:
- Theo chu kỳ cài đặt, mặc định 12 giờ một lần.
- Chỉ chạy nếu người dùng bật tính năng.

Người dùng thấy gì:
- Thông báo ngắn: số ghi chú, số chủ đề, gợi ý ưu tiên ôn.
- Nút mở nhanh vào thanh bên.

Người dùng làm gì:
- Chọn "Mở ôn tập" hoặc "Xem chi tiết".

Ví dụ:
- "Bạn có 9 ghi chú trong 3 chủ đề. Nên ôn chủ đề 'Attention' trước."

### 4) Luồng Ảnh chụp ngữ cảnh (Visual Anchor)

Khi nào chạy:
- Sau khi lưu ghi chú, nếu người dùng bật tính năng ảnh chụp.

Người dùng thấy gì:
- Ảnh nhỏ đính kèm ghi chú để dễ nhớ đoạn đã đọc.

Ràng buộc:
- Ảnh nhỏ khoảng 200x120, dung lượng không vượt 50KB.

Ví dụ:
- "Ảnh chụp đã lưu để bạn nhớ đúng đoạn trong trang."

### 5) Luồng Tiến trình học (Learning Analytics)

Khi nào hiện:
- Trong thanh bên, phần "Tiến trình của bạn".

Người dùng thấy gì:
- Số đã lưu, đã ôn, đã xuất trong tuần.
- Chủ đề nổi bật.
- Mức hiểu theo chủ đề.
- Gợi ý ngắn từ bản tổng hợp gần nhất.

Ví dụ:
- "Tuần này: Lưu 18, Ôn 11, Xuất 6. Chủ đề mạnh nhất: Retrieval."

### 6) Luồng Truy cập bằng trợ lý AI (MCP Bridge)

Khi nào dùng:
- Người dùng chủ động cài cầu nối và bật quyền truy cập.

Người dùng thấy gì:
- Trạng thái kết nối rõ ràng: "Đã kết nối" hoặc "Chưa cài".
- Mô tả rõ: dữ liệu ở máy local, có thể tắt bất cứ lúc nào.

Giải thích ngắn từ kỹ thuật:
- Cầu nối local là chương trình chạy trên máy người dùng để chuyển yêu cầu giữa extension và công cụ AI.

Ví dụ:
- "Trợ lý AI có thể đọc ghi chú của bạn khi bạn cho phép."

Quyết định hành động cho toàn bộ luồng:
- Design: Dùng 1 ngôn ngữ nhất quán, tránh tên nội bộ như "Comprehension Gate" trên UI.
- Dev: Giữ các ngưỡng mặc định của phase này: 5 ghi chú, 4 giờ, 60 phút, tối đa 5 liên quan, ngưỡng 0.65, heartbeat 12 giờ.
- QA: Viết test theo từng luồng ở trên, có test bật/tắt từng tính năng và test không làm phiền lặp lại.

## Luật an toàn/guardrails

Các luật bắt buộc:
- Quyền kiểm soát thuộc về người dùng: mọi tính năng tự động đều có bật/tắt.
- Không chặn việc đọc: nhắc ôn tập là thẻ nhẹ, không khóa nội dung.
- Hạn chế làm phiền: có thời gian nghỉ giữa các lần nhắc.
- Ưu tiên riêng tư: dữ liệu giữ trên máy; cầu nối MCP là tùy chọn.
- Lọc thông tin nhạy cảm trước khi gửi cho công cụ AI.
- Giới hạn tần suất yêu cầu từ cầu nối MCP để tránh lạm dụng.
- Ghi nhật ký truy cập MCP để tra soát khi cần.

Giải thích ngắn từ kỹ thuật:
- Thông tin nhạy cảm (PII) là dữ liệu nhận diện cá nhân như email, số điện thoại, địa chỉ.

Quyết định hành động:
- Design: Luôn có dòng giải thích "Bạn có thể tắt bất cứ lúc nào" ở khu vực MCP.
- Dev: Áp dụng giới hạn 30 yêu cầu mỗi phút cho MCP và có log truy cập.
- QA: Kiểm tra đầy đủ các trường hợp từ chối quyền, tắt tính năng, và lọc dữ liệu nhạy cảm.

## Trường hợp lỗi & thông điệp

| Trường hợp lỗi | Thông điệp gợi ý cho người dùng | Quyết định cho Design/Dev/QA |
|---|---|---|
| Không lấy được danh sách ghi chú chờ ôn | "Hiện chưa tải được danh sách ôn tập. Vui lòng thử lại sau ít phút." | Design: hiển thị dạng thông báo nhẹ. Dev: tự thử lại 1 lần. QA: giả lập lỗi đọc dữ liệu cục bộ. |
| Không tìm được ghi chú liên quan | "Chưa tìm thấy ghi chú liên quan cho mục này." | Design: không hiển thị vùng trống. Dev: trả về danh sách rỗng an toàn. QA: kiểm tra không vỡ giao diện. |
| Không chụp được ảnh ngữ cảnh | "Không lưu được ảnh chụp cho ghi chú này, nhưng nội dung chữ vẫn đã lưu." | Design: thông điệp trấn an. Dev: lưu ghi chú ngay cả khi ảnh lỗi. QA: chặn quyền chụp để test. |
| Thông báo định kỳ bị tắt quyền | "Bạn đang tắt thông báo. Bật lại để nhận tổng hợp định kỳ." | Design: kèm nút mở cài đặt. Dev: phát hiện trạng thái quyền. QA: test cả 2 trạng thái quyền. |
| Chưa cài cầu nối MCP | "Bạn chưa cài công cụ kết nối AI. Mở hướng dẫn cài đặt?" | Design: CTA rõ ràng "Mở hướng dẫn". Dev: phát hiện thiếu cài đặt và fallback an toàn. QA: test máy chưa cài. |
| Vượt giới hạn yêu cầu MCP | "Yêu cầu đang nhiều, vui lòng thử lại sau ít phút." | Design: dùng câu ngắn, không đổ lỗi. Dev: chặn theo ngưỡng 30/phút. QA: bắn tải cao để xác nhận chặn. |
| Dung lượng lưu ảnh gần đầy | "Bộ nhớ ảnh chụp gần đầy. Hệ thống sẽ tự dọn ảnh cũ trước." | Design: thông báo trước khi mất dữ liệu phụ. Dev: xóa ảnh cũ trước, giữ nội dung chữ. QA: mô phỏng gần đầy bộ nhớ. |
| Không có dữ liệu tiến trình tuần | "Tuần này bạn chưa có dữ liệu đủ để tổng hợp." | Design: hiển thị trạng thái rỗng thân thiện. Dev: trả về dữ liệu mặc định 0. QA: test người dùng mới. |

## Tiêu chí hoàn thành (acceptance)

### A. Nhắc ôn tập
1. Hệ thống chỉ hiện nhắc khi đủ các điều kiện ngưỡng đã chốt.
2. "Ôn ngay" mở đúng khu vực ôn trong thanh bên.
3. "Nhắc lại sau" hoãn đúng 60 phút.
4. "Đóng" không nhắc lại trong 4 giờ.
5. Không hiện đè trùng với thông báo nhắc khác.

### B. Ghi chú liên quan
1. Mỗi ghi chú có tối đa 5 liên kết liên quan.
2. Chỉ nhận liên kết đạt ngưỡng độ giống từ 0.65.
3. Giao diện hiển thị nhãn liên quan dễ hiểu.
4. Nếu không có liên quan, giao diện vẫn ổn định.

### C. Tổng hợp định kỳ
1. Chạy theo chu kỳ cài đặt, mặc định 12 giờ.
2. Tạo được bản tổng hợp có số ghi chú, số chủ đề, ưu tiên ôn.
3. Bấm thông báo mở đúng điểm đến (ôn tập hoặc chi tiết).
4. Tôn trọng trạng thái bật/tắt thông báo và heartbeat.

### D. Ảnh chụp ngữ cảnh
1. Ghi chú vẫn lưu thành công kể cả khi ảnh lỗi.
2. Ảnh đính kèm giữ kích thước nhỏ và dưới 50KB.
3. Nếu người dùng tắt tính năng, hệ thống không chụp ảnh.

### E. Tiến trình học
1. Hiển thị đủ số đã lưu, đã ôn, đã xuất theo tuần.
2. Có danh sách chủ đề nổi bật và mức hiểu.
3. Có trạng thái rỗng rõ ràng cho người dùng mới.

### F. Truy cập AI qua MCP
1. Tính năng là tùy chọn, mặc định không ép buộc.
2. Chỉ hoạt động khi cầu nối local đã cài và kết nối thành công.
3. Có lọc thông tin nhạy cảm trước khi trả dữ liệu.
4. Có giới hạn 30 yêu cầu/phút và có log truy cập.

Tiêu chí bàn giao chung cho Design/Dev/QA:
- Design sign-off: tất cả microcopy đúng ngữ điệu thân thiện, không dùng từ nội bộ.
- Dev sign-off: tất cả ngưỡng mặc định đúng tài liệu và có cờ bật/tắt từng tính năng.
- QA sign-off: có test cho luồng thành công, luồng lỗi, và luồng quyền truy cập.

## Những gì KHÔNG làm ở phase này

Không triển khai trong Phase 2:
- Không làm bản đồ tri thức dạng đồ thị trực quan.
- Không dùng AI nâng cao để tự suy luận sâu loại liên kết.
- Không đồng bộ đám mây hoặc đa thiết bị.
- Không làm tính năng cộng tác nhiều người.
- Không tự tạo flashcard ôn cách quãng.
- Không mở rộng sang backend dịch vụ mới bên ngoài.
- Không tự tạo notebook tự động theo chủ đề.
- Không mở rộng kênh xuất mới ngoài phạm vi đã có.

Lý do giữ phạm vi:
- Tập trung hoàn thiện trải nghiệm cốt lõi của Phase 2.
- Giảm rủi ro kỹ thuật và rủi ro làm phiền người dùng.
- Giữ timeline kiểm thử và bàn giao gọn.

---

Phiên bản: 2.0 non-tech-ready  
Phạm vi: Giữ nguyên intent của Smart Research Queue Phase 2
