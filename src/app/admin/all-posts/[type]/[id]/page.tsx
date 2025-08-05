// src/app/admin/all-posts/[type]/[id]/page.tsx
'use client';

import {useEffect, useState, useMemo, Fragment, useCallback} from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

// [수정됨] 댓글 타입 확장
interface Comment {
  id: number;
  content: string;
  created_at: string;
  author: { name: string; } | null;
  parent_comment_id: number | null;
  replies?: Comment[]; // 대댓글을 담을 배열
}

interface PostDetails {
  id: number;
  title: string;
  content: string;
  created_at: string;
  author: { name: string; } | null;
  comments: Comment[];
  image_urls?: string[];
}

// [신규] 재귀적인 댓글 컴포넌트
const CommentItem = ({ comment, onReply, onDelete, boardType, postId, onActionSuccess }: {
  comment: Comment;
  onReply: (commentId: number) => void;
  onDelete: (commentId: number) => void;
  boardType: string;
  postId: number;
  onActionSuccess: () => void;
}) => {
  const [showActions, setShowActions] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [replyContent, setReplyContent] = useState('');

  const handleReplySubmit = async () => {
    if (!replyContent.trim()) {
      alert('대댓글 내용을 입력해주세요.');
      return;
    }
    try {
      const response = await fetch('/api/admin/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId,
          boardType,
          content: replyContent,
          parent_comment_id: comment.id,
        }),
      });
      if (!response.ok) throw new Error('대댓글 작성에 실패했습니다.');

      alert('대댓글이 작성되었습니다.');
      setReplyContent('');
      setIsReplying(false);
      onActionSuccess(); // 전체 댓글 목록 새로고침
    } catch (err) {
      alert(err instanceof Error ? err.message : '오류가 발생했습니다.');
    }
  };

  return (
    <div className={`p-4 border rounded-md ${comment.parent_comment_id ? 'ml-8 bg-gray-50' : 'bg-white'}`}>
      <div className="flex justify-between items-start">
        <div>
          <button onClick={() => setShowActions(!showActions)} className="font-semibold text-gray-700 text-left hover:text-indigo-600">
            {comment.author?.name || '익명'}
          </button>
          <p className="text-gray-600 my-1">{comment.content}</p>
          <p className="text-xs text-gray-400">{new Date(comment.created_at).toLocaleString()}</p>
        </div>
        {showActions && (
          <div className="flex flex-col items-end space-y-2 flex-shrink-0 ml-4">
            {!comment.parent_comment_id && ( // 대댓글에는 답글 달기 버튼 비활성화
              <button onClick={() => { setIsReplying(!isReplying); setShowActions(false); }} className="text-xs text-blue-500 hover:text-blue-700 font-semibold">
                대댓글 달기
              </button>
            )}
            <button onClick={() => { onDelete(comment.id); setShowActions(false); }} className="text-xs text-red-500 hover:text-red-700 font-semibold">
              삭제하기
            </button>
          </div>
        )}
      </div>

      {isReplying && (
        <div className="mt-4 flex gap-2">
          <textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            className="w-full text-sm border-gray-300 rounded-md p-2"
            rows={2}
            placeholder={`${comment.author?.name || '익명'}님에게 대댓글 남기기...`}
          />
          <button onClick={handleReplySubmit} className="px-3 py-1 bg-indigo-600 text-white text-xs font-semibold rounded-md hover:bg-indigo-700 flex-shrink-0">
            등록
          </button>
        </div>
      )}

      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-4 space-y-4 border-t pt-4">
          {comment.replies.map(reply => (
            <CommentItem
              key={reply.id}
              comment={reply}
              onReply={onReply}
              onDelete={onDelete}
              boardType={boardType}
              postId={postId}
              onActionSuccess={onActionSuccess}
            />
          ))}
        </div>
      )}
    </div>
  );
};


export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { type, id } = params;

  const [post, setPost] = useState<PostDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPostDetails = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/all-posts/${type}/${id}`);
      if (!response.ok) {
        throw new Error('게시물 정보를 불러오는 데 실패했습니다.');
      }
      const data = await response.json();
      setPost(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류 발생');
    } finally {
      setLoading(false);
    }
  }, [type, id]); // useCallback의 dependency array 수정

  useEffect(() => {
    if (type && id) {
      fetchPostDetails();
    }
  }, [type, id, fetchPostDetails]);

  // [신규] 댓글 목록을 계층 구조로 변환하는 로직
  const nestedComments = useMemo(() => {
    if (!post?.comments) return [];
    const commentsById: { [key: number]: Comment } = {};
    const topLevelComments: Comment[] = [];

    post.comments.forEach(comment => {
      comment.replies = [];
      commentsById[comment.id] = comment;
    });

    post.comments.forEach(comment => {
      if (comment.parent_comment_id && commentsById[comment.parent_comment_id]) {
        commentsById[comment.parent_comment_id].replies?.push(comment);
      } else {
        topLevelComments.push(comment);
      }
    });
    return topLevelComments;
  }, [post?.comments]);


  const handleDeleteComment = async (commentId: number) => {
    if (window.confirm('정말로 이 댓글을 삭제하시겠습니까? 대댓글도 함께 삭제됩니다.')) {
      try {
        const response = await fetch(`/api/admin/comments/${commentId}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('댓글 삭제에 실패했습니다.');
        await fetchPostDetails(); // 목록 새로고침
        alert('댓글이 삭제되었습니다.');
      } catch (err) {
        alert(err instanceof Error ? err.message : '오류가 발생했습니다.');
      }
    }
  };

  if (loading) return <div className="text-center p-8">로딩 중...</div>;
  if (error) return <div className="text-center text-red-500 p-8">오류: {error}</div>;
  if (!post) return <div className="text-center p-8">게시물을 찾을 수 없습니다.</div>;

  return (
    <div className="container mx-auto p-4 md:p-6">
      <button onClick={() => router.back()} className="mb-6 text-indigo-600 hover:underline">
        &larr; 목록으로 돌아가기
      </button>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">{post.title}</h1>
        <div className="text-sm text-gray-500 mb-4">
          <span>작성자: {post.author?.name || '정보 없음'}</span>
          <span className="mx-2">|</span>
          <span>작성일: {new Date(post.created_at).toLocaleString()}</span>
        </div>
        <div className="prose max-w-none text-gray-800 whitespace-pre-wrap mb-6">
          {post.content}
        </div>

      {/* [수정됨] 댓글 목록 렌더링 */}
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">댓글 ({post.comments.length}개)</h2>
        <div className="space-y-4">
          {nestedComments.length > 0 ? (
            nestedComments.map(comment => (
              <CommentItem
                key={comment.id}
                comment={comment}
                onReply={() => {}} // 현재는 답글 폼을 CommentItem 내부에서 관리
                onDelete={handleDeleteComment}
                boardType={type as string}
                postId={post.id}
                onActionSuccess={fetchPostDetails}
              />
            ))
          ) : (
            <p className="text-gray-500">작성된 댓글이 없습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}
